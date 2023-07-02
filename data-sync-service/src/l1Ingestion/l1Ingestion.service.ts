import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  L1RelayedMessageEvents,
  L1SentMessageEvents,
  L1ToL2,
  L2RelayedMessageEvents,
  L2SentMessageEvents,
  L2ToL1,
  StateBatches,
  TxnBatches,
  Transactions,
  Tokens,
  DaBatches,
  DaBatchTransactions,
  TokenPriceHistory,
  TokenPriceRealTime,
} from 'src/typeorm';
import {
  EntityManager,
  getConnection,
  getManager,
  Repository,
  IsNull,
  Not,
  In,
  LessThan,
} from 'typeorm';
import Web3 from 'web3';
import CMGABI from '../abi/L1CrossDomainMessenger.json';
import CTCABI from '../abi/CanonicalTransactionChain.json';
import SCCABI from '../abi/StateCommitmentChain.json';
import DAABI from '../abi/BVM_EigenDataLayrChain.json';
import { L2IngestionService } from '../l2Ingestion/l2Ingestion.service';
import { EigenlayerService } from '../grpc/eigenlayer.service';
import { utils } from 'ethers';
import { Gauge } from "prom-client";
import { InjectMetric } from "@willsoto/nestjs-prometheus";
import { from } from 'rxjs';
const FraudProofWindow = 0;
let l1l2MergerIsProcessing = false;
import { decode, encode } from 'rlp';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class L1IngestionService {
  private readonly logger = new Logger(L1IngestionService.name);
  entityManager: EntityManager;
  web3: Web3;
  ctcContract: any;
  sccContract: any;
  crossDomainMessengerContract: any;
  bvmEigenDataLayrChain: any;
  constructor(
    private configService: ConfigService,
    @InjectRepository(L1RelayedMessageEvents)
    private readonly relayedEventsRepository: Repository<L1RelayedMessageEvents>,
    @InjectRepository(L1SentMessageEvents)
    private readonly sentEventsRepository: Repository<L1SentMessageEvents>,
    @InjectRepository(StateBatches)
    private readonly stateBatchesRepository: Repository<StateBatches>,
    @InjectRepository(TxnBatches)
    private readonly txnBatchesRepository: Repository<TxnBatches>,
    @InjectRepository(L2ToL1)
    private readonly txnL2ToL1Repository: Repository<L2ToL1>,
    @InjectRepository(L1ToL2)
    private readonly txnL1ToL2Repository: Repository<L1ToL2>,
    @InjectRepository(TokenPriceHistory)
    private readonly tokenPriceHistory: Repository<TokenPriceHistory>,
    @InjectRepository(Transactions)
    private readonly transactions: Repository<Transactions>,
    @InjectRepository(Tokens)
    private readonly tokensRepository: Repository<Tokens>,
    @InjectRepository(DaBatches)
    private readonly daBatchesRepository: Repository<DaBatches>,
    @InjectRepository(DaBatchTransactions)
    private readonly DaBatchTransactionsRepository: Repository<DaBatchTransactions>,
    private readonly l2IngestionService: L2IngestionService,
    private readonly eigenlayerService: EigenlayerService,
    private readonly httpService: HttpService,
    @InjectMetric('eigenlayer_batch_index')
    public metricEigenlayerBatchIndex: Gauge<string>,
    @InjectMetric('state_batch_index')
    public metricStateBatchIndex: Gauge<string>,
    @InjectMetric('queue_index')
    public metricQueueIndex: Gauge<string>,
    @InjectMetric('l2_to_l1_l1_hash')
    public metricL2ToL1L1Hash: Gauge<string>,
  ) {
    this.entityManager = getManager();
    const web3 = new Web3(
      new Web3.providers.HttpProvider(configService.get('L1_RPC')),
    );
    const crossDomainMessengerContract = new web3.eth.Contract(
      CMGABI as any,
      configService.get('L1_CROSS_DOMAIN_MESSENGER_ADDRESS'),
    );
    const ctcContract = new web3.eth.Contract(
      CTCABI as any,
      configService.get('CTC_ADDRESS'),
    );
    const sccContract = new web3.eth.Contract(
      SCCABI as any,
      configService.get('SCC_ADDRESS'),
    );
    const bvmEigenDataLayrChain = new web3.eth.Contract(
      DAABI as any,
      configService.get('DA_ADDRESS'),
    );
    this.ctcContract = ctcContract;
    this.sccContract = sccContract;
    this.crossDomainMessengerContract = crossDomainMessengerContract;
    this.bvmEigenDataLayrChain = bvmEigenDataLayrChain;
    this.web3 = web3;
  }
  async getCtcTransactionBatchAppendedByBlockNumber(
    fromBlock: number,
    toBlock: number,
  ) {
    return this.ctcContract.getPastEvents('TransactionBatchAppended', {
      fromBlock,
      toBlock,
    });
  }
  async getSccStateBatchAppendedByBlockNumber(
    fromBlock: number,
    toBlock: number,
  ) {
    return this.sccContract.getPastEvents('StateBatchAppended', {
      fromBlock,
      toBlock,
    });
  }
  async getSentMessageByBlockNumber(fromBlock: number, toBlock: number) {
    return this.crossDomainMessengerContract.getPastEvents('SentMessage', {
      fromBlock,
      toBlock,
    });
  }
  async getRelayedMessageByBlockNumber(fromBlock: number, toBlock: number) {
    return this.crossDomainMessengerContract.getPastEvents('RelayedMessage', {
      fromBlock,
      toBlock,
    });
  }
  async getLatestBatchIndex() {
    return this.bvmEigenDataLayrChain.methods.rollupBatchIndex().call();
  }
  async getRollupInfoByBatchIndex(batch_index) {
    return this.bvmEigenDataLayrChain.methods
      .getRollupStoreByRollupBatchIndex(batch_index)
      .call();
  }
  async getSccTotalElements() {
    return this.sccContract.methods.getTotalElements().call();
  }
  async getFRAUD_PROOF_WINDOW() {
    return this.sccContract.methods.FRAUD_PROOF_WINDOW().call();
  }
  verifyDomainCalldataHash({ target, sender, message, messageNonce }): string {
    const xDomainCalldata = this.web3.eth.abi.encodeFunctionCall(
      {
        name: 'relayMessage',
        type: 'function',
        inputs: [
          { type: 'address', name: 'target' },
          { type: 'address', name: 'sender' },
          { type: 'bytes', name: 'message' },
          { type: 'uint256', name: 'messageNonce' },
        ],
      },
      [target, sender, message, messageNonce],
    );
    return Web3.utils.keccak256(xDomainCalldata);
  }
  async getCurrentBlockNumber(): Promise<number> {
    return this.web3.eth.getBlockNumber();
  }
  async getSentEventsBlockNumber(): Promise<number> {
    const result = await this.sentEventsRepository
      .createQueryBuilder()
      .select('Max(block_number)', 'blockNumber')
      .getRawOne();
    return Number(result.blockNumber) || 0;
  }
  async getRelayedEventsBlockNumber(): Promise<number> {
    const result = await this.relayedEventsRepository
      .createQueryBuilder()
      .select('Max(block_number)', 'blockNumber')
      .getRawOne();
    return Number(result.blockNumber) || 0;
  }
  async getTxnBatchBlockNumber(): Promise<number> {
    const result = await this.txnBatchesRepository
      .createQueryBuilder()
      .select('Max(block_number)', 'blockNumber')
      .getRawOne();
    return Number(result.blockNumber) || 0;
  }
  async getStateBatchBlockNumber(): Promise<number> {
    const result = await this.stateBatchesRepository
      .createQueryBuilder()
      .select('Max(block_number)', 'blockNumber')
      .getRawOne();
    return Number(result.blockNumber) || 0;
  }
  async getTokenPriceStartTime(): Promise<number> {
    const result = await this.tokenPriceHistory
      .createQueryBuilder()
      .select('Max(start_time)', 'startTime')
      .getRawOne();
    console.log("latest token price result", result)
    return Number(result?.startTime || this.configService.get('TOKEN_PRICE_START_TIME'));
  }
  async getUnMergeSentEvents() {
    return this.sentEventsRepository.find({ where: { is_merge: false } });
  }
  async getL2toL1WaitTx(status) {
    return this.txnL2ToL1Repository.find({ where: { status: status } });
  }
  async createTxnBatchesEvents(startBlock, endBlock) {
    console.log('txn batch start block', startBlock, endBlock)
    const list = await this.getCtcTransactionBatchAppendedByBlockNumber(
      startBlock,
      endBlock,
    );
    const txnBatchesInsertData: any[] = []
    for (const item of list) {
      const {
        blockNumber,
        transactionHash,
        returnValues: {
          _batchIndex,
          _batchRoot,
          _batchSize,
          _prevTotalElements,
          _signature,
          _extraData,
        },
      } = item;
      const { timestamp } = await this.web3.eth.getBlock(blockNumber);
      txnBatchesInsertData.push({
        batch_index: _batchIndex,
        block_number: blockNumber.toString(),
        hash: transactionHash,
        size: _batchSize,
        l1_block_number: blockNumber,
        batch_root: _batchRoot,
        extra_data: _extraData,
        pre_total_elements: _prevTotalElements,
        timestamp: new Date(Number(timestamp) * 1000).toISOString(),
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }
    const result: any[] = [];
    const dataSource = getConnection();
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.startTransaction();
      const savedResult = await queryRunner.manager.insert(TxnBatches, txnBatchesInsertData);
      result.push(savedResult);
      await queryRunner.commitTransaction();
    } catch (error) {
      this.logger.error(
        `l1 createTxnBatchesEvents ${error}`,
      );
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
    return result;
  }

  async createStateBatchesEvents(startBlock, endBlock) {
    console.log('state batch start block', startBlock, endBlock)
    const list = await this.getSccStateBatchAppendedByBlockNumber(
      startBlock,
      endBlock,
    );
    const stateBatchesInsertData: any[] = [];
    for (const item of list) {
      const {
        blockNumber,
        transactionHash,
        returnValues: {
          _batchIndex,
          _batchRoot,
          _batchSize,
          _prevTotalElements,
          _extraData,
        },
      } = item;
      console.log(`the state batch index will be insert into db: ${_batchIndex}`)
      const { timestamp } = await this.web3.eth.getBlock(blockNumber);
      stateBatchesInsertData.push({
        batch_index: _batchIndex,
        block_number: blockNumber.toString(),
        hash: transactionHash,
        size: _batchSize,
        l1_block_number: blockNumber,
        batch_root: _batchRoot,
        extra_data: _extraData,
        pre_total_elements: _prevTotalElements,
        timestamp: new Date(Number(timestamp) * 1000).toISOString(),
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      this.metricStateBatchIndex.set(Number(_batchIndex));
    }
    const result: any[] = [];
    const dataSource = getConnection();
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.startTransaction();
      const savedResult = await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into(StateBatches)
        .values(stateBatchesInsertData)
        .onConflict(`("batch_index") DO NOTHING`)
        .execute()
      result.push(savedResult);
      await queryRunner.commitTransaction();
    } catch (error) {
      this.logger.error(
        `l1 createStateBatchesEvents ${error}, insert state batch failed, start and end block number ${startBlock} ${endBlock}`,
      );
      await queryRunner.rollbackTransaction();
      return Promise.reject(`insert state batch failed`)
    } finally {
      await queryRunner.release();
    }
    return result;
  }
  async createSentEvents(startBlock, endBlock) {
    const list = await this.getSentMessageByBlockNumber(startBlock, endBlock);
    console.log(`l1 sent message fetched list start block & end block & list length: `, startBlock, endBlock, list.length)
    const iface = new utils.Interface([
      'function claimReward(uint256 _blockStartHeight, uint32 _length, uint256 _batchTime, address[] calldata _tssMembers)',
      'function finalizeDeposit(address _l1Token, address _l2Token, address _from, address _to, uint256 _amount, bytes calldata _data)',
      'function rollBackL2Chain(uint256 _shouldRollBack, uint256 _shouldStartAtElement, bytes memory _signature)',
    ]);
    let l1_token = '0x0000000000000000000000000000000000000000';
    let l2_token = '0x0000000000000000000000000000000000000000';
    let from = '0x0000000000000000000000000000000000000000';
    let to = '0x0000000000000000000000000000000000000000';
    let value = '0';
    let type = -1;
    const l1SentMessageEventsInsertData: any[] = [];
    const l1ToL2InsertData: any[] = [];
    for (const item of list) {
      const {
        blockNumber,
        transactionHash,
        returnValues: { target, sender, message, messageNonce, gasLimit },
        signature,
      } = item;
      const funName = message.slice(0, 10);
      if (funName === '0x662a633a') {
        const decodeMsg = iface.decodeFunctionData('finalizeDeposit', message);
        l1_token = decodeMsg._l1Token;
        l2_token = decodeMsg._l2Token;
        from = decodeMsg._from;
        to = decodeMsg._to;
        value = this.web3.utils.hexToNumberString(decodeMsg._amount._hex);
        type = 1; // user deposit
        this.logger.log(
          `l1_token: [${l1_token}], l2_token: [${l2_token}], from: [${from}], to: [${to}], value: [${value}]`,
        );
      } else if (funName === '0x0fae75d9') {
        const decodeMsg = iface.decodeFunctionData('claimReward', message);
        type = 0; // reward
        this.logger.log(`reward tssMembers is [${decodeMsg._tssMembers}]`);
      } else if (funName === '0xf523f40d') {
        const decodeMsg = iface.decodeFunctionData('rollBackL2Chain', message);
        type = 2; // rollBackL2Chain
      }
      if(type === -1) continue;
      const { timestamp } = await this.web3.eth.getBlock(blockNumber);
      const msgHash = this.verifyDomainCalldataHash({
        target: target.toString(),
        sender: sender.toString(),
        message: message.toString(),
        messageNonce: messageNonce.toString(),
      });
      console.log("-------------- l1 sent message block", blockNumber)
      console.log("target", target)
      console.log("sender", sender)
      console.log("message", message)
      console.log("messageNonce", messageNonce)
      console.log("msgHash", msgHash)
      l1SentMessageEventsInsertData.push({
        tx_hash: transactionHash,
        block_number: blockNumber.toString(),
        target,
        sender,
        message,
        message_nonce: messageNonce,
        gas_limit: gasLimit,
        signature,
        l1_token: l1_token,
        l2_token: l2_token,
        from: from,
        to: to,
        value: value,
        type: type,
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      l1ToL2InsertData.push({
        hash: transactionHash,
        l2_hash: null,
        msg_hash: msgHash,
        block: blockNumber,
        timestamp: new Date(Number(timestamp) * 1000).toISOString(),
        tx_origin: sender,
        queue_index: Number(messageNonce),
        target: sender,
        gas_limit: gasLimit,
        status: '1',
        l1_token: l1_token,
        l2_token: l2_token,
        from: from,
        to: to,
        value: value,
        type: type,
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      this.metricQueueIndex.set(Number(messageNonce))
    }
    const dataSource = getConnection();
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    let inserted = true;
    try {
      await queryRunner.startTransaction();
      await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into(L1SentMessageEvents)
        .values(l1SentMessageEventsInsertData)
        .onConflict(`("message_nonce") DO NOTHING`)
        .execute().catch(e => {
          console.error('insert l1 sent message events failed:', e.message)
          throw Error(e.message)
        });

      await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into(L1ToL2)
        .values(l1ToL2InsertData)
        .onConflict(`("queue_index") DO NOTHING`)
        .execute().catch(e => {
          console.error('insert l1 to l2 failed:', e.message)
          throw Error(e.message)
        });
      await queryRunner.commitTransaction();
    } catch (error) {
      inserted = false;
      console.error(error)
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
    return Promise.resolve(inserted);
  }

  queryReorgBlockNumber(confirmBlock) {
    return this.txnL1ToL2Repository.find({
      where: { l2_hash: null, block: LessThan(confirmBlock) },
      order: { block: 'DESC' },
      select: ["block"],
      take: 100,
    });
  }

  queryLatestBlockNumberWhichIncludeL2Hash() {
    return this.txnL1ToL2Repository.findOne({
      where: { l2_hash: Not(IsNull()) },
      order: { block: 'DESC' },
      select: ["block"],
    });
  }

  async updateReorgBlockMessage() {
    const latestIncludesL2HashBlockNumber = await this.queryLatestBlockNumberWhichIncludeL2Hash();
    console.log('latest l1 to l2 transaction block number not includes l2 hash', latestIncludesL2HashBlockNumber)
    if (latestIncludesL2HashBlockNumber.block && !Number.isNaN(latestIncludesL2HashBlockNumber.block)) {
      const reorgBlockNumberList = await this.queryReorgBlockNumber(Number(latestIncludesL2HashBlockNumber.block));
      console.log('reorg block list', reorgBlockNumberList)
      if (reorgBlockNumberList?.length === 0) return;
      reorgBlockNumberList.forEach((l) => {
        this.fetchReorgDataAndUpdate(l.block)
      })
    }
  }

  async fetchReorgDataAndUpdate(block) {
    const list = await this.getSentMessageByBlockNumber(block, block);
    if (list?.length === 0) return;
    list.forEach(async (blockRes) => {
      const {
        returnValues: { target, sender, message, messageNonce },
      } = blockRes;
      const msgHash = this.verifyDomainCalldataHash({
        target: target.toString(),
        sender: sender.toString(),
        message: message.toString(),
        messageNonce: messageNonce.toString(),
      });

      const dataSource = getConnection();
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      try {
        await queryRunner.startTransaction();
        await queryRunner.manager
          .createQueryBuilder()
          .update(L1SentMessageEvents)
          .set({
            message
          })
          .where({ message_nonce: messageNonce })
          .execute().catch(e => {
            console.error('update reorg block l1 sent message events failed', e.message)
            throw Error(e.message)
          });
        await queryRunner.manager
          .createQueryBuilder()
          .update(L1ToL2)
          .set({
            msg_hash: msgHash
          })
          .where({ queue_index: Number(messageNonce) })
          .execute().catch(e => {
            console.error('update reorg block l1 to l2 failed', e.message)
            throw Error(e.message)
          });
          console.log(`update l1 sent message events and l1 to l2 successful, block`, block)
          console.log(`nonce`, messageNonce)
          console.log(`msg_hash`, msgHash)
        await queryRunner.commitTransaction();
      } catch (error) {
        console.error(error)
        await queryRunner.rollbackTransaction();
      } finally {
        await queryRunner.release();
      }
    })
  }

  async createRelayedEvents(startBlock, endBlock) {
    const list = await this.getRelayedMessageByBlockNumber(
      startBlock,
      endBlock,
    );
    const l1RelayedMessageEventsInsertData: any[] = [];
    for (const item of list) {
      const {
        blockNumber,
        transactionHash,
        returnValues: { msgHash },
        signature,
      } = item;
      l1RelayedMessageEventsInsertData.push({
        tx_hash: transactionHash,
        block_number: blockNumber.toString(),
        msg_hash: msgHash,
        signature,
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      this.metricL2ToL1L1Hash.set(blockNumber)
    }
    
    return getConnection()
      .createQueryBuilder()
      .insert()
      .into(L1RelayedMessageEvents)
      .values(l1RelayedMessageEventsInsertData)
      .onConflict(`("msg_hash") DO NOTHING`)
      .execute().catch(e => {
        console.error(`insert l1 relayed message events failed,`, e.message)
        throw Error(e.message)
      });

  }
  async createL1L2Relation() {
    if (!l1l2MergerIsProcessing) {
      const unMergeTxList =
        await this.l2IngestionService.getRelayedEventByIsMerge(false);
      this.logger.log(`start create l1->l2 relation`);
      const l1ToL2UpdateList = []
      const l1SentMessageEventsTxHashList = []
      const l2RelayedMessageEventsTxHashList = []
      for (let i = 0; i < unMergeTxList.length; i++) {
        const l1ToL2Transaction = await this.getL1ToL2TxByMsgHash(
          unMergeTxList[i].msg_hash,
        );
        if (l1ToL2Transaction) {
          let tx_type = 1;
          if (l1ToL2Transaction.type === 0) {
            tx_type = 3;
          }
          l1ToL2UpdateList.push({
            l2_hash: unMergeTxList[i].tx_hash,
            status: '2',
            hash: l1ToL2Transaction.hash
          })
          l1SentMessageEventsTxHashList.push(l1ToL2Transaction.hash)
          l2RelayedMessageEventsTxHashList.push(unMergeTxList[i].tx_hash)
        }
      }
      const dataSource = getConnection();
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        await queryRunner.manager
          .createQueryBuilder()
          .setLock('pessimistic_write')
          .insert()
          .into(L1ToL2)
          .values(l1ToL2UpdateList)
          .orUpdate(["l2_hash", "status"], ["hash"], {
            skipUpdateIfNoValuesChanged: true
          })
          .execute();
        await queryRunner.manager
          .createQueryBuilder()
          .setLock('pessimistic_write')
          .update(L1SentMessageEvents)
          .set({ is_merge: true })
          .where({ tx_hash: In(l1SentMessageEventsTxHashList) })
          .execute();
        await queryRunner.manager
          .createQueryBuilder()
          .setLock('pessimistic_write')
          .update(L2RelayedMessageEvents)
          .set({ is_merge: true })
          .where({ tx_hash: In(l2RelayedMessageEventsTxHashList) })
          .execute();
        // await queryRunner.manager.query(
        //   `UPDATE transactions SET l1_origin_tx_hash=$1, l1l2_type=$2 WHERE hash=$3;`,
        //   [unMergeTxList[i].tx_hash, tx_type, l1ToL2Transaction.l2_hash],
        // );
        await queryRunner.commitTransaction();
        this.logger.log(`commit l1->l2 data successes`);
      } catch (error) {
        this.logger.error(
          `create l1->l2 relation to l1_to_l2 table error ${error}`,
        );
        await queryRunner.rollbackTransaction();
      } finally {
        await queryRunner.release();
        this.logger.log(`create l1->l2 relation to l1_to_l2 table finish`);
      }
      l1l2MergerIsProcessing = false;
    } else {
      this.logger.log(
        `this task is in processing and l1l2MergerIsProcessing is ${l1l2MergerIsProcessing}`,
      );
    }
  }
  async createEigenBatchTransaction(insertBatchData, insertHashData) {

    await getConnection()
      .createQueryBuilder()
      .insert()
      .into(DaBatches)
      .values(insertBatchData)
      .onConflict(`("da_hash") DO NOTHING`)
      .execute().catch(e => {
        console.error('insert da batches failed', e.message)
        throw Error(e.message)
      });

    await getConnection()
      .createQueryBuilder()
      .setLock('pessimistic_write')
      .insert()
      .into(DaBatchTransactions)
      .values(insertHashData)
      .orUpdate(["block_number"], ["tx_hash"], {
        skipUpdateIfNoValuesChanged: true
      })
      .execute().catch(e => {
        console.error('insert da batch transactions failed', e.message)
        throw Error(e.message)
      });

  }
  async createL2L1Relation() {
    const unMergeTxList = await this.getRelayedEventByIsMerge(false);
    const l2ToL1UpdateList = [];
    const l2SentMessageEventsTxHashList = [];
    const l1RelayedMessageEventsTxHashList = [];
    for (let i = 0; i < unMergeTxList.length; i++) {
      const l2ToL1Transaction = await this.getL2ToL1TxByMsgHash(
        unMergeTxList[i].msg_hash,
      );
      if (l2ToL1Transaction) {
        l2ToL1UpdateList.push({
          hash: unMergeTxList[i].tx_hash,
          status: '2',
          l2_hash: l2ToL1Transaction.l2_hash
        })
        l2SentMessageEventsTxHashList.push(l2ToL1Transaction.l2_hash)
        l1RelayedMessageEventsTxHashList.push(unMergeTxList[i].tx_hash)
      }
    }
    const dataSource = getConnection();
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager
        .createQueryBuilder()
        .setLock('pessimistic_write')
        .insert()
        .into(L2ToL1)
        .values(l2ToL1UpdateList)
        .orUpdate(["hash", "status"], ["l2_hash"], {
          skipUpdateIfNoValuesChanged: true
        })
        .execute();
      await queryRunner.manager
        .createQueryBuilder()
        .setLock('pessimistic_write')
        .update(L2SentMessageEvents)
        .set({ is_merge: true })
        .where({ tx_hash: In(l2SentMessageEventsTxHashList) })
        .execute();
      await queryRunner.manager
        .createQueryBuilder()
        .setLock('pessimistic_write')
        .update(L1RelayedMessageEvents)
        .set({ is_merge: true })
        .where({ tx_hash: In(l1RelayedMessageEventsTxHashList) })
        .execute();
      // update transactions to Ready for Relay
      // await queryRunner.manager.query(
      //   `UPDATE transactions SET l1_origin_tx_hash=$1, l1l2_type=$2 WHERE hash=$3;`,
      //   [unMergeTxList[i].tx_hash, 2, l2ToL1Transaction.l2_hash],
      // );
      await queryRunner.commitTransaction();
      this.logger.log(
        `create l2->l1 relation to l2_to_l1 table commit transaction finish`,
      );
    } catch (error) {
      this.logger.log(
        `create l2->l1 relation to l2_to_l1 table error ${error}`,
      );
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
      this.logger.log(`create l2->l1 relation to l2_to_l1 table finish`);
    }
  }

  async getRelayedEventByMsgHash(msgHash: string) {
    return this.relayedEventsRepository.findOne({
      where: { msg_hash: msgHash },
    });
  }
  async getRelayedEventByIsMerge(is_merge: boolean, take: number = 100) {
    return this.relayedEventsRepository.find({
      where: { is_merge: is_merge },
      order: { block_number: 'DESC' },
      take
    });
  }
  async getL2ToL1TxByMsgHash(msgHash: string) {
    return this.txnL2ToL1Repository.findOne({
      where: { msg_hash: msgHash },
    });
  }
  async getL1ToL2TxByMsgHash(msgHash: string) {
    return this.txnL1ToL2Repository.findOne({
      where: { msg_hash: msgHash },
    });
  }
  async getRelayedEventByTxHash(txHash: string) {
    return this.relayedEventsRepository.findOne({
      where: { tx_hash: txHash },
    });
  }
  async getSentEventByTxHash(txHash: string) {
    return this.sentEventsRepository.findOne({
      where: { tx_hash: txHash },
    });
  }
  async getL1ToL2Relation() {
    const sentList = await this.sentEventsRepository.find();
    const result = [];
    for (const item of sentList) {
      const { target, sender, message, message_nonce } = item;
      const msgHash = this.verifyDomainCalldataHash({
        target: target.toString(),
        sender: sender.toString(),
        message: message.toString(),
        messageNonce: message_nonce.toString(),
      });
      const relayedResult =
        await this.l2IngestionService.getRelayedEventByMsgHash(msgHash);
      result.push({
        block_number: item.block_number,
        queue_index: message_nonce.toString(),
        l2_tx_hash: relayedResult.tx_hash.toString(),
        l1_tx_hash: item.tx_hash.toString(),
        gas_limit: item.gas_limit,
      });
    }
    return result;
  }
  async getL2ToL1Relation() {
    const sentList = await this.l2IngestionService.getAllSentEvents();
    const result = [];
    for (const item of sentList) {
      const { target, sender, message, message_nonce } = item;
      const msgHash = this.l2IngestionService.verifyDomainCalldataHash({
        target: target.toString(),
        sender: sender.toString(),
        message: message.toString(),
        messageNonce: message_nonce.toString(),
      });
      const relayedResult = await this.getRelayedEventByMsgHash(msgHash);
      result.push({
        message_nonce: message_nonce.toString(),
        l2_tx_hash: item.tx_hash.toString(),
        l1_tx_hash: relayedResult ? relayedResult.tx_hash.toString() : null,
      });
    }
    return result;
  }
  async getL1L2Transaction(address, page, page_size, type, order) {
    const result = [];
    const new_page = page - 1;
    if (type == 1) {
      const deposits = await this.txnL1ToL2Repository.find({
        where: { from: address },
        order: { queue_index: order },
        skip: new_page,
        take: page_size,
      });
      for (const item of deposits) {
        let l1_hash = '';
        let l2_hash = '';
        if (item.hash != null) {
          l1_hash = Buffer.from(item.hash).toString();
        }
        if (item.l2_hash != null) {
          l2_hash = Buffer.from(item.l2_hash).toString();
        }
        let token_name = '';
        let token_symbol = '';
        if (
          item.l2_token != '0x0000000000000000000000000000000000000000' ||
          item.l2_token != null
        ) {
          const queryToken = await this.tokensRepository.findOne({
            where: {
              contract_address_hash: Buffer.from(item.l2_token)
                .toString()
                .replace('0x', '\\x'),
            },
          });
          if (queryToken != null) {
            token_name = queryToken.name;
            token_symbol = queryToken.symbol;
          } else {
            token_name = item.name;
            token_symbol = item.symbol;
          }
        } else {
          token_name = item.name;
          token_symbol = item.symbol;
        }
        result.push({
          l1_hash: l1_hash,
          l2_hash: l2_hash,
          block: item.block,
          name: token_name,
          status: item.status,
          symbol: token_symbol,
          l1_token: Buffer.from(item.l1_token).toString(),
          l2_token: Buffer.from(item.l2_token).toString(),
          from: Buffer.from(item.from).toString(),
          to: Buffer.from(item.to).toString(),
          value: item.value,
        });
      }
    }
    if (type == 2) {
      const withdraw = await this.txnL2ToL1Repository.find({
        where: { from: address },
        order: { msg_nonce: order },
        skip: new_page,
        take: page_size,
      });
      for (const item of withdraw) {
        let l1_hash = '';
        let l2_hash = '';
        if (item.hash != null) {
          l1_hash = Buffer.from(item.hash).toString();
        }
        if (item.l2_hash != null) {
          l2_hash = Buffer.from(item.l2_hash).toString();
        }
        let token_name = '';
        let token_symbol = '';
        if (
          item.l2_token != '0x0000000000000000000000000000000000000000' ||
          item.l2_token != null
        ) {
          const queryToken = await this.tokensRepository.findOne({
            where: {
              contract_address_hash: Buffer.from(item.l2_token)
                .toString()
                .replace('0x', '\\x'),
            },
          });
          if (queryToken != null) {
            token_name = queryToken.name;
            token_symbol = queryToken.symbol;
          } else {
            token_name = item.name;
            token_symbol = item.symbol;
          }
        } else {
          token_name = item.name;
          token_symbol = item.symbol;
        }
        result.push({
          l1_hash: l1_hash,
          l2_hash: l2_hash,
          block: item.block,
          name: token_name,
          status: item.status,
          symbol: token_symbol,
          l1_token: Buffer.from(item.l1_token).toString(),
          l2_token: Buffer.from(item.l2_token).toString(),
          from: Buffer.from(item.from).toString(),
          to: Buffer.from(item.to).toString(),
          value: item.value,
        });
      }
    }
    return {
      ok: true,
      code: 2000,
      result: result,
    };
  }
  async syncEigenDaBatch(batchIndexParam) {
    const { batchIndex } = await this.eigenlayerService.getLatestTransactionBatchIndex();
    this.logger.log(`[syncEigenDaBatch] latestBatchIndex: ${batchIndex}`);
    if (batchIndexParam > Number(batchIndex)) {
      return Promise.resolve(false);
    }
    this.metricEigenlayerBatchIndex.set(Number(batchIndex))
    const res = await this.eigenlayerService.getRollupStoreByRollupBatchIndex(batchIndexParam);
    if (!res) {
      return Promise.resolve(false);
    }
    if (!res || res?.batchIndex === null || res?.dataStore === null) {
      return Promise.resolve(true);
    }
    let fromStoreNumber, upgrade_data_store_id
    if (res?.dataStore?.data_store_id) {
      fromStoreNumber = res?.dataStore?.data_store_id;
    }
    if (res?.dataStore?.upgrade_data_store_id) {
      upgrade_data_store_id = res?.dataStore?.upgrade_data_store_id;
    }

    console.log('eigenda data', res)
    console.log('store number', fromStoreNumber)
    console.log('upgrade_data_store_id', upgrade_data_store_id)
    if (+fromStoreNumber === 0) {
      this.logger.log(`[syncEigenDaBatch] latestBatchIndex: ${fromStoreNumber}`);
      return Promise.resolve(false);
    }
    let number = fromStoreNumber;
    if (upgrade_data_store_id && upgrade_data_store_id !== 0) {
      number += upgrade_data_store_id
    }
    const dataStoreData = await this.eigenlayerService.getDataStore(fromStoreNumber);
    console.log('current data store data:', dataStoreData?.dataStore, fromStoreNumber)
    if (dataStoreData?.dataStore !== null) {
      const {
        index: Index,
        storePeriodLength: StorePeriodLength,
        confirmed: Confirmed,
        msgHash: MsgHash,
        durationDataStoreId: DurationDataStoreId,
        storeNumber: StoreNumber,
        fee: Fee,
        initTxHash: InitTxHash,
        confirmTxHash: ConfirmTxHash,
        dataCommitment: DataCommitment,
        stakesFromBlockNumber: StakesFromBlockNumber,
        initTime: InitTime,
        expireTime: ExpireTime,
        duration: Duration,
        numSys: NumSys,
        numPar: NumPar,
        degree: Degree,
        confirmer: Confirmer,
        header: Header,
        initGasUsed: InitGasUsed,
        initBlockNumber: InitBlockNumber,
        ethSigned: EthSigned,
        eigenSigned: EigenSigned,
        signatoryRecord: SignatoryRecord,
        confirmGasUsed: ConfirmGasUsed
      } = dataStoreData.dataStore
      this.logger.log(`[syncEigenDaBatch] latestBatchIndex index:${Index}`);
      if (Index === undefined || Index === '') {
        this.logger.log(`[syncEigenDaBatch] latestBatchIndex Index === undefined || Index === ''`);
        return Promise.resolve(true);
      }
      const CURRENT_TIMESTAMP = new Date().toISOString();
      const insertBatchData = {
        batch_index: batchIndexParam,
        batch_size: 0,
        status: Confirmed ? 'confirmed' : 'init',
        da_hash: utils.hexlify(MsgHash),
        store_id: DurationDataStoreId,
        store_number: StoreNumber,
        da_fee: Fee,
        da_init_hash: utils.hexlify(InitTxHash),
        da_store_hash: utils.hexlify(ConfirmTxHash),
        from_store_number: fromStoreNumber,
        inserted_at: CURRENT_TIMESTAMP,
        updated_at: CURRENT_TIMESTAMP,
        data_commitment: DataCommitment,
        stakes_from_block_number: StakesFromBlockNumber,
        init_time: new Date(Number(InitTime) * 1000).toISOString(),
        expire_time: new Date(Number(ExpireTime) * 1000).toISOString(),
        duration: Duration,
        num_sys: NumSys,
        num_par: NumPar,
        degree: Degree,
        confirmer: Confirmer,
        header: Header,
        init_gas_used: InitGasUsed,
        init_block_number: InitBlockNumber,
        eth_signed: EthSigned,
        eigen_signed: EigenSigned,
        signatory_record: SignatoryRecord,
        confirm_gas_used: ConfirmGasUsed
      }
      let insertHashData = null;
      // if Confirmed = true then get EigenDa tx list, else skip
      if (Confirmed) {
        const { txList } = await this.eigenlayerService.getTxn(number) || [];
        const insertHashList = [];
        insertBatchData.batch_size = txList.length || 0;
        txList.forEach((item) => {
          insertHashList.push({
            batch_index: batchIndexParam,
            block_number: item.blockNumber,
            tx_hash: item.txHash,
            inserted_at: CURRENT_TIMESTAMP,
            updated_at: CURRENT_TIMESTAMP
          })
        })
        insertHashData = insertHashList
      }
      await this.createEigenBatchTransaction(insertBatchData, insertHashData);
    } else {
      console.log('------ da_batch data response null')
    }
    return Promise.resolve(true);
  }
  async getLastFromStoreNumber() {
    const result = await this.daBatchesRepository
      .createQueryBuilder()
      .select('Max(from_store_number)', 'fromStoreNumber')
      .getRawOne();
    return Number(result.fromStoreNumber) || 0;
  }
  async getLastBatchIndex() {
    const result = await this.daBatchesRepository
      .createQueryBuilder()
      .select('Max(batch_index)', 'batchIndex')
      .getRawOne();
    return Number(result.batchIndex) || 0;
  }
  // async syncEigenDaBatchTxn() {
  //   const data1 = await this.eigenlayerService.getDataStore(2);
  //   const data2 = await this.eigenlayerService.getDataStore(3);
  //   console.log(data1, data2);
  //   return {
  //     data1: {
  //       ...data1,
  //       MsgHash: utils.hexlify(data1.MsgHash),
  //       InitTxHash: utils.hexlify(data1.InitTxHash),
  //       ConfirmTxHash: utils.hexlify(data1.ConfirmTxHash),
  //       DataCommitment: utils.hexlify(data1.DataCommitment),
  //       SignatoryRecord: utils.hexlify(data1.SignatoryRecord),
  //     },
  //     data2: {
  //       ...data2,
  //       MsgHash: utils.hexlify(data2.MsgHash),
  //       InitTxHash: utils.hexlify(data2.InitTxHash),
  //       ConfirmTxHash: utils.hexlify(data2.ConfirmTxHash),
  //       DataCommitment: utils.hexlify(data2.DataCommitment),
  //       SignatoryRecord: utils.hexlify(data2.SignatoryRecord),
  //     },
  //   }
  // }
  async getDepositList(address, offset, limit) {
    const result = []
    const deposits = await this.txnL1ToL2Repository.findAndCount({
      where: { from: address, type: 1 },
      order: { queue_index: 'DESC' },
      // skip: offset,
      take: limit,
    });
    const list = deposits[0];
    const total = deposits[1];
    for (const item of list) {
      const l1_hash = item.hash ? Buffer.from(item.hash).toString() : null;
      const l2_hash = item.l2_hash ? Buffer.from(item.l2_hash).toString() : null;
      result.push({
        l1_hash,
        l2_hash,
        transactionHash: Buffer.from(item.hash).toString(),
        block: Number(item.block),
        status: item.status,
        l1_token: Buffer.from(item.l1_token).toString(),
        l2_token: Buffer.from(item.l2_token).toString(),
        from: Buffer.from(item.from).toString(),
        to: Buffer.from(item.to).toString(),
        amount: item.value,
        blockTimestamp: new Date(item.timestamp).getTime(),
        queue_index: item.queue_index,
        name: null,
        symbol: null,
      });
    }
    return {
      isSuccess: true,
      items: result,
      pagination: {
        total,
        offset,
        limit
      }
    };
  }
  async getWithdrawList(address, offset, limit) {
    const result = []
    const withdrawals = await this.txnL2ToL1Repository.findAndCount({
      where: { from: address },
      order: { msg_nonce: 'DESC' },
      // skip: offset,
      take: limit,
    });
    const list = withdrawals[0];
    const total = withdrawals[1];
    for (const item of list) {
      const l1_hash = item.hash ? Buffer.from(item.hash).toString() : null;
      const l2_hash = item.l2_hash ? Buffer.from(item.l2_hash).toString() : null;
      result.push({
        l1_hash,
        l2_hash,
        transactionHash: Buffer.from(item.l2_hash).toString(),
        block: Number(item.block),
        status: item.status,
        l1_token: Buffer.from(item.l1_token).toString(),
        l2_token: Buffer.from(item.l2_token).toString(),
        from: Buffer.from(item.from).toString(),
        to: Buffer.from(item.to).toString(),
        amount: item.value,
        blockTimestamp: new Date(item.timestamp).getTime(),
        msg_nonce: item.msg_nonce,
        name: null,
        symbol: null,
      });
    }
    return {
      isSuccess: true,
      items: result,
      pagination: {
        total,
        offset,
        limit
      }
    };
  }

  async syncTokenPriceHistory() {
    console.log('start sync token price')
    const historyLatestTime = await this.getTokenPriceStartTime().catch(e => {
      console.error(`query start time from token price history failed`, e)
      throw Error('')
    });
    console.log('latest history time', historyLatestTime)
    let startTime = historyLatestTime + 3600000;
    console.log('sync token price start time', startTime)
    if (startTime) {
      if ((startTime + 3600000) <= (new Date().getTime())) {
        this.fetchTokenPriceHistory(startTime);
      } else {
        console.log('token price has synced the latest one')
      }
    }
  }

  async fetchTokenPriceHistory(startTime) {
    const endTime = startTime + 3599999;
    //TODO(Jayce) use BIT token price temp
    console.log('start fetch token price')
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(
          `https://api.bybit.com/v5/market/kline?symbol=BITUSDT&category=spot&interval=60&start=${startTime}&end=${endTime}`,
          {
            timeout: 5000,
          }
        )
      )
      if (data?.retCode === 0 && data?.result?.list?.length > 0) {
        const keyLineData = data.result.list[0];
        if (keyLineData[4]) {
          const price = Number(keyLineData[4]);
          this.saveTokenPriceData(startTime, endTime, price)
        }

      }
    } catch (e) {
      console.error(e)
      console.error(`fetch token price failed, ${e.message}`)
    }
  }

  async saveTokenPriceData(startTime, endTime, price) {
    const historyData = [{
      start_time: startTime,
      end_time: endTime,
      mnt_to_usd: price
    }]
    const dataSource = getConnection();
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.startTransaction();
      const savedResult = await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into(TokenPriceHistory)
        .values(historyData)
        //.onConflict(`("start_time") DO NOTHING`)
        .execute()
      console.log('save result from token price', savedResult);
      if (savedResult) {
        console.log("restart sync data")
        setTimeout(() => { this.syncTokenPriceHistory() }, 50)
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      this.logger.error(
        `insert token price data failed ${error}`,
      );
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }

  }

  async syncTokenPriceRealTime() {
    try {
      console.log('start sync token price real time')
      const { data } = await firstValueFrom(
        this.httpService.get(
          `https://api.bybit.com/v5/market/tickers?category=inverse&symbol=BITUSD`,
          {
            timeout: 5000,
          }
        )
      )
      console.log('token price real time data')
      console.log(data)
      if (data?.retCode === 0 && data?.result?.list?.length > 0) {
        const realtimePrice = data.result.list[0];
        if (realtimePrice.lastPrice) {
          const price = Number(realtimePrice.lastPrice);
          this.saveTokenRealTimeData(price)
        }

      }
    } catch (e) {
      console.error(e)
      console.error(`fetch token price failed, ${e.message}`)
    }
  }

  async saveTokenRealTimeData(price) {
    const realTimeData = [{
      token_id: 'mnt',
      mnt_to_usd: price,
      mnt_to_eth: null,
      mnt_to_btc: null,
    }]
    const dataSource = getConnection();
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.startTransaction();
      const savedResult = await queryRunner.manager
        .createQueryBuilder()
        .setLock('pessimistic_write')
        .insert()
        .into(TokenPriceRealTime)
        .values(realTimeData)
        .orUpdate(["mnt_to_usd"], ["token_id"], {
          skipUpdateIfNoValuesChanged: true
        })
        .execute();
      console.log('token price real time updated', savedResult);
      await queryRunner.commitTransaction();
    } catch (error) {
      this.logger.error(
        `update token price real time failed ${error}`,
      );
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }

  }

}
