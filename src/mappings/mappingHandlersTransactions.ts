import {SubstrateBlock} from "@subql/types";
import { TransactionsPerBlock } from "../types";
import { getBlockTimestampInUnix } from "./utils";

const extrinsicsToCount = ['balances.transfer', 'ethCall.call', 'evm.call'];

export async function handleBlock(block: SubstrateBlock): Promise<void> {
    if (block.timestamp){
      const transactions = await handleDayStartEnd(block);
      let transactionsInBlock = 0;

      block.block.extrinsics.forEach((ex, index) => {
        const { isSigned, method: { method, section } } = ex;
        const extrinsic = `${section}.${method}`;

        if (extrinsicsToCount.includes(extrinsic) || extrinsic.startsWith('dappsStaking.')) {
          transactionsInBlock ++;
        }
      });

      transactions.numberOfTransactions += transactionsInBlock;
      await transactions.save();
    } else {
      logger.warn(`Block ${block.block.header.number}. Timestamp not defined`);
    }
}

async function handleDayStartEnd(block: SubstrateBlock): Promise<TransactionsPerBlock> {
  const date = formatDate(block.timestamp);

  let transactions = await TransactionsPerBlock.get(date);
  if (!transactions) {
    transactions = new TransactionsPerBlock(date);
    transactions.firstBlock = block.block.header.number.toNumber();
    transactions.numberOfTransactions = 0;
    transactions.timestamp = BigInt(0);
    await transactions.save();

    const prevDate = new Date(block.timestamp);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevTransactions = await TransactionsPerBlock.get(formatDate(prevDate));
    if (prevTransactions) {
      prevTransactions.lastBlock = transactions.firstBlock - 1;
      const blocksCount = prevTransactions.lastBlock.valueOf() - prevTransactions.firstBlock;
      const avgNumberOfTransactions = prevTransactions.numberOfTransactions / blocksCount;
      prevTransactions.avgNumberOfTransactions = avgNumberOfTransactions;
      prevTransactions.timestamp = getBlockTimestampInUnix(block);
      await prevTransactions.save();
    }
  }

  return transactions;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0,10).replace(/-/g, '');
}