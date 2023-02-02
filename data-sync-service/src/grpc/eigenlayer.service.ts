// eslint-disable-next-line @typescript-eslint/no-var-requires
const proto_loader = require('@grpc/proto-loader');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const grpc = require('@grpc/grpc-js');
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class EigenlayerService {
  private readonly logger = new Logger(EigenlayerService.name);
  private configService = new ConfigService();
  client: any;
  constructor() {
    const proto_path = this.configService.get('PROTO_PATH');
    const pkg_def = proto_loader.loadSync(proto_path, {
      keepCase: true,
      defaults: true,
      enums: String,
      oneofs: true,
    });
    const rpc_pkg =
      grpc.loadPackageDefinition(pkg_def).interfaceRetrieverServer;
    this.client = new rpc_pkg.DataRetrieval(
      this.configService.get('RETRIEVER_SOCKET'),
      grpc.credentials.createInsecure(),
    );
  }

  async retrieveFramesAndData(dataStoreId: number) {
    const framesAndDataRequest = {
      DataStoreId: dataStoreId,
    };
    const response = this.client.RetrieveFramesAndData(framesAndDataRequest);
    console.log('retrieve response is:', response);
    return response;
  }
}
