import { Transactions } from './transactions.entity';
import { L1ToL2 } from './l1_to_l2.entity';
import { L2ToL1 } from './l2_to_l1.entity';
import { Blocks } from './blocks.entity';
import { TransactionStats } from './transactions_stats.entity';
import { L1RelayedMessageEvents } from './l1_relayed_message_events.entity';
import { L1SentMessageEvents } from './l1_sent_message_events.entity';
import { L2RelayedMessageEvents } from './l2_relayed_message_events.entity';
import { L2SentMessageEvents } from './l2_sent_message_events.entity';
import { StateBatches } from './state_batches.entity';
import { TxnBatches } from './txn_batches.entity';
import { Tokens } from './tokens.entity';
import { DaBatches } from './da_batches.entity';
import { DaBatchTransactions } from './da_batch_transactions.entity';
import { TokenPriceHistory } from './token_price_history.entity';
import { TokenPriceRealTime } from './token_price_real_time.entity';
import { Addresses } from './addresses.entity';
import { Last24HrsStats } from './last_24hrs_stats.entity';

const entities = [
  L1ToL2,
  L2ToL1,
  L1RelayedMessageEvents,
  L1SentMessageEvents,
  L2RelayedMessageEvents,
  L2SentMessageEvents,
  StateBatches,
  TxnBatches,
  Transactions,
  Tokens,
  DaBatches,
  DaBatchTransactions,
  TokenPriceHistory,
  TokenPriceRealTime,
  Addresses,
  Blocks,
  TransactionStats,
  Last24HrsStats,
];

export {
  L1ToL2,
  L2ToL1,
  L1RelayedMessageEvents,
  L1SentMessageEvents,
  L2RelayedMessageEvents,
  L2SentMessageEvents,
  StateBatches,
  TxnBatches,
  Transactions,
  Tokens,
  DaBatches,
  DaBatchTransactions,
  TokenPriceHistory,
  TokenPriceRealTime,
  Addresses,
  Blocks,
  TransactionStats,
  Last24HrsStats,
};
export default entities;
