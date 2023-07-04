import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  L1SentMessageEvents,
  L1ToL2,
  L2RelayedMessageEvents,
  L2SentMessageEvents,
  L2ToL1,
} from 'src/typeorm';
import { EntityManager, getConnection, getManager, Repository } from 'typeorm';
import Web3 from 'web3';
import ABI from '../abi/L2CrossDomainMessenger.json';
import { utils } from 'ethers';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Gauge } from "prom-client";
import { InjectMetric } from "@willsoto/nestjs-prometheus";

@Injectable()
export class L2IngestionService {
  private readonly logger = new Logger(L2IngestionService.name);
  entityManager: EntityManager;
  web3: Web3;
  crossDomainMessengerContract: any;
  WithdrawalMethod: string = 'finalizeMantleWithdrawal'
  WithdrawalMethodHexPrefix: string = '0xf82b418e'

  constructor(
    private configService: ConfigService,
    @InjectRepository(L2RelayedMessageEvents)
    private readonly relayedEventsRepository: Repository<L2RelayedMessageEvents>,
    @InjectRepository(L2SentMessageEvents)
    private readonly sentEventsRepository: Repository<L2SentMessageEvents>,
    @InjectRepository(L2ToL1)
    private readonly l2ToL1Repository: Repository<L2ToL1>,
    private readonly httpService: HttpService,
    @InjectMetric('msg_nonce')
    public metricMsgNonce: Gauge<string>,
    @InjectMetric('l1_to_l2_l2_hash')
    public metricL1ToL2L2Hash: Gauge<string>,
    @InjectMetric('l2_to_l1_status')
    public metricL2ToL1Status: Gauge<string>,
  ) {
    this.entityManager = getManager();
    const web3 = new Web3(
      new Web3.providers.HttpProvider(configService.get('L2_RPC')),
    );
    this.crossDomainMessengerContract = new web3.eth.Contract(
      ABI as any,
      configService.get('L2_CROSS_DOMAIN_MESSENGER_ADDRESS'),
    );
    this.web3 = web3;
    /* if(configService.get('ENV') !== 'mainnet'){
      this.WithdrawalMethod = 'finalizeBitWithdrawal'
      this.WithdrawalMethodHexPrefix = '0x839f0ec6'
    } */
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
  async createSentEvents(startBlock, endBlock) {
    const list = await this.getSentMessageByBlockNumber(startBlock, endBlock);
    const iface = new utils.Interface([
      'function finalizeETHWithdrawal(address _from, address _to, uint256 _amount, bytes calldata _data)',
      `function ${this.WithdrawalMethod}(address _from, address _to, uint256 _amount, bytes calldata _data)`,
      'function finalizeERC20Withdrawal(address _l1Token, address _l2Token, address _from, address _to, uint256 _amount, bytes calldata _data)',
    ]);
    const l2SentMessageEventsInsertData: any[] = [];
    const l2ToL1InsertData: any[] = [];
    for (const item of list) {
      const {
        blockNumber,
        transactionHash,
        returnValues: { target, sender, message, messageNonce, gasLimit },
        signature,
      } = item;
      const funName = message.slice(0, 10);
      let name = '';
      let symbol = '';
      let l1_token = '0x0000000000000000000000000000000000000000';
      let l2_token = '0x0000000000000000000000000000000000000000';
      let from = '0x0000000000000000000000000000000000000000';
      let to = '0x0000000000000000000000000000000000000000';
      let value = '0';
      // finalizeETHWithdrawal
      if (funName === '0x1532ec34') {
        const decodeMsg = iface.decodeFunctionData(
          'finalizeETHWithdrawal',
          message,
        );
        name = 'ETH';
        symbol = 'ETH';
        from = decodeMsg._from;
        to = decodeMsg._to;
        value = this.web3.utils.hexToNumberString(decodeMsg._amount._hex);
        l1_token = '0x0000000000000000000000000000000000000000'
        l2_token = '0xdeaddeaddeaddeaddeaddeaddeaddeaddead1111'
        this.logger.log(
          `finalizeETHWithdrawal: from: [${from}], to: [${to}], value: [${value}]`,
        );
      }
      // finalizeERC20Withdrawal
      if (funName === '0xa9f9e675') {
        const decodeMsg = iface.decodeFunctionData(
          'finalizeERC20Withdrawal',
          message,
        );
        name = 'ERC20';
        symbol = 'ERC20';
        l1_token = decodeMsg._l1Token;
        l2_token = decodeMsg._l2Token;
        from = decodeMsg._from;
        to = decodeMsg._to;
        value = this.web3.utils.hexToNumberString(decodeMsg._amount._hex);
        this.logger.log(
          `finalizeERC20Withdrawal: l1_token: [${l1_token}], l2_token: [${l2_token}], from: [${from}], to: [${to}], value: [${value}]`,
        );
      }
      // finalizeMantleWithdrawal
      if (funName === this.WithdrawalMethodHexPrefix) {
        const decodeMsg = iface.decodeFunctionData(
          this.WithdrawalMethod,
          message,
        );
        name = 'MNT';
        symbol = 'MNT';
        from = decodeMsg._from;
        to = decodeMsg._to;
        value = this.web3.utils.hexToNumberString(decodeMsg._amount._hex);
        l1_token = '0x1a4b46696b2bb4794eb3d4c26f1c55f9170fa4c5'
        l2_token = '0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000'
        this.logger.log(
          `${this.WithdrawalMethod}: from: [${from}], to: [${to}], value: [${value}]`,
        );
      }
      const { timestamp } = await this.web3.eth.getBlock(blockNumber);
      const msgHash = this.verifyDomainCalldataHash({
        target: target.toString(),
        sender: sender.toString(),
        message: message.toString(),
        messageNonce: messageNonce.toString(),
      });
      l2SentMessageEventsInsertData.push({
        tx_hash: transactionHash,
        block_number: blockNumber.toString(),
        target,
        sender,
        message,
        message_nonce: messageNonce,
        gas_limit: gasLimit,
        signature,
        timestamp: new Date(Number(timestamp) * 1000).toISOString(),
        name: name,
        symbol: symbol,
        l1_token: l1_token,
        l2_token: l2_token,
        from: from,
        to: to,
        value: value,
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      l2ToL1InsertData.push({
        hash: null,
        l2_hash: transactionHash,
        msg_hash: msgHash,
        block: blockNumber,
        msg_nonce: Number(messageNonce),
        from_address: target,
        txn_batch_index: Number(messageNonce),
        state_batch_index: Number(messageNonce),
        timestamp: new Date(Number(timestamp) * 1000).toISOString(),
        status: '0', // '0': "Waiting for relay"  '1': "Ready for Claim"   '2':"Relayed"
        gas_limit: gasLimit,
        l1_token: l1_token,
        l2_token: l2_token,
        from: from,
        to: to,
        value: value,
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      this.metricMsgNonce.set(Number(messageNonce))
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
        .into(L2SentMessageEvents)
        .values(l2SentMessageEventsInsertData)
        .onConflict(`("message_nonce") DO NOTHING`)
        .execute().catch(e => {
          console.error('insert l2 sent message events failed:', e.message)
          throw Error(e.message)
        });

      await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into(L2ToL1)
        .values(l2ToL1InsertData)
        .onConflict(`("l2_hash") DO NOTHING`)
        .execute().catch(e => {
          console.error('insert l2 to l1 failed:', e.message)
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
  async createRelayedEvents(startBlock, endBlock) {
    const list = await this.getRelayedMessageByBlockNumber(
      startBlock,
      endBlock,
    );
    console.log('---------------------------------- l2 relayed message events start and end:', startBlock, endBlock)
    const l2RelayedMessageEventsInsertData: any = [];
    for (const item of list) {
      const {
        blockNumber,
        transactionHash,
        returnValues: { msgHash },
        signature,
      } = item;
      const { timestamp } = await this.web3.eth.getBlock(blockNumber);
      l2RelayedMessageEventsInsertData.push({
        tx_hash: transactionHash,
        block_number: blockNumber.toString(),
        msg_hash: msgHash,
        signature,
        timestamp: new Date(Number(timestamp) * 1000).toISOString(),
        inserted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      this.metricL1ToL2L2Hash.set(blockNumber)
    }

    return getConnection()
      .createQueryBuilder()
      .insert()
      .into(L2RelayedMessageEvents)
      .values(l2RelayedMessageEventsInsertData)
      .onConflict(`("msg_hash") DO NOTHING`)
      .execute().catch(e => {
        console.error(`insert l2 relayed message events failed,`, e.message)
        throw Error(e.message)
      });

  }

  async getAllSentEvents() {
    return this.sentEventsRepository.find();
  }
  async getUnMergeSentEvents() {
    return this.sentEventsRepository.find({ where: { is_merge: false } });
  }
  async getAllRelayedEvents() {
    return this.relayedEventsRepository.find();
  }
  async getRelayedEventByMsgHash(msgHash: string) {
    return this.relayedEventsRepository.findOne({
      where: { msg_hash: msgHash },
    });
  }
  async getRelayedEventByIsMerge(is_merge: boolean, take: number = 300) {
    return this.relayedEventsRepository.find({
      where: { is_merge: is_merge },
      order: { block_number: "DESC" },
      take
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
  async fixedL2ToL1TokenAddress0x000Bug() {
    const list = await this.sentEventsRepository.find({
      select: ['tx_hash', 'message', 'message_nonce'],
      where: {
        l2_token: '0x0000000000000000000000000000000000000000'
      },
      take: 1000
    })
    if (list.length <= 0) {
      this.logger.log('fixedL2ToL1TokenAddress0x000Bug finished');
      return [];
    }
    const updateL2ToL1Data = []
    const updateSentEventsData = []
    for (const item of list) {
      const message = item.message.toString();
      const tx_hash = item.tx_hash.toString();
      const message_nonce = item.message_nonce.toString();
      const funName = message.slice(0, 10);
      let l1_token = '0x0000000000000000000000000000000000000000';
      let l2_token = '0x0000000000000000000000000000000000000000';
      // finalizeETHWithdrawal
      if (funName === '0x1532ec34') {
        l1_token = '0x0000000000000000000000000000000000000000'
        l2_token = '0xdeaddeaddeaddeaddeaddeaddeaddeaddead1111'
      }
      // finalizeMantleWithdrawal
      if (funName === this.WithdrawalMethodHexPrefix) {
        // mainnet BitDAO
        l1_token = '0x1a4b46696b2bb4794eb3d4c26f1c55f9170fa4c5'
        l2_token = '0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000'
      }
      updateL2ToL1Data.push({
        l2_hash: tx_hash,
        l1_token,
        l2_token
      })
      updateSentEventsData.push({
        message_nonce,
        l1_token,
        l2_token
      })
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
        .values(updateL2ToL1Data)
        .orUpdate(['l1_token', 'l2_token'], ['l2_hash'], {
          skipUpdateIfNoValuesChanged: true
        })
        .execute();
      await queryRunner.manager
        .createQueryBuilder()
        .setLock('pessimistic_write')
        .insert()
        .into(L2SentMessageEvents)
        .values(updateSentEventsData)
        .orUpdate(['l1_token', 'l2_token'], ['message_nonce'], {
          skipUpdateIfNoValuesChanged: true
        })
        .execute();
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
    return updateL2ToL1Data;
  }
  async getTxStatusDetailByHash(txHash) {
    const { data } = await firstValueFrom(
      this.httpService.post(`${this.configService.get('L2_RPC')}`, {
        id: 0,
        method: 'eth_getTxStatusDetailByHash',
        params: [txHash]
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      })
    );
    return data;
  }
  async handleWaitTransaction() {
    const list = await this.l2ToL1Repository.find({
      select: ['l2_hash', 'msg_nonce'],
      where: {
        status: '0'
      },
      take: 50,
      order: {
        block: 'ASC'
      }
    });
    if (list.length > 0) {
      this.metricL2ToL1Status.set(Number(list[0].msg_nonce))
    }
    const updateL2ToL1Data = []
    for (let item of list) {
      const l2_hash = item.l2_hash.toString();
      const { result } = await this.getTxStatusDetailByHash(l2_hash);
      const timestamp = new Date().getTime();
      console.log(`tx detail: ${timestamp} `, result);
      if (result && (result.status === '0x3' || result.status === '0x03')) {
        updateL2ToL1Data.push({
          l2_hash: l2_hash,
          status: '1'
        })
      } else {
        console.log('this l2 hash can not find its status detail', l2_hash)
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
        .values(updateL2ToL1Data)
        .orUpdate(['status'], ['l2_hash'], {
          skipUpdateIfNoValuesChanged: true
        })
        .execute();
      await queryRunner.commitTransaction();
    } catch (error) {
      this.logger.error(`l2l1 change status error ${error}`);
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
      this.logger.log(`l2l1 change status to Waiting finish`);
    }
  }
}
