import {
  ApiCredentials,
  BearerTokenCredentials,
  IAMCredentials
} from '@adastradev/serverless-discovery-sdk';

// ignore type checking for private member aws-api-gateway-client for now
// declare function require(name:string): any; // tslint:disable-line
const apigClientFactory: any = require('@adastradev/aws-api-gateway-client').default; // tslint:disable-line

// interceptor logging for Authorization headers
// axios.interceptors.request.use(function(config) {
//     var authorizationHeader = config.headers['Authorization'];
//     console.log('Authorization header: ' + authorizationHeader);
//     return config;
// });

export class UserManagementApi {
  private apigClient: any;
  private additionalParams: any;

  constructor(
    serviceEndpointUri: string,
    region: string,
    credentials: ApiCredentials,
    apigClient?: any
  ) {
    if (apigClient) {
      if (credentials.type === 'BearerToken') {
        const tokenCreds = credentials as BearerTokenCredentials;
        this.additionalParams = {
          headers: {
            Authorization: `Bearer ${tokenCreds.idToken}`
          }
        };
      }
      this.apigClient = apigClient;
    } else {
      if (credentials.type === 'None') {
        this.apigClient = apigClientFactory.newClient({
          region,
          accessKey: '',
          invokeUrl: serviceEndpointUri,
          secretKey: ''
        });
      } else if (credentials.type === 'IAM') {
        const iamCreds = credentials as IAMCredentials;
        this.apigClient = apigClientFactory.newClient({
          region,
          accessKey: iamCreds.accessKeyId,
          invokeUrl: serviceEndpointUri,
          secretKey: iamCreds.secretAccessKey,
          sessionToken: iamCreds.sessionToken
        });
      } else if (credentials.type === 'BearerToken') {
        const tokenCreds = credentials as BearerTokenCredentials;
        this.additionalParams = {
          headers: {
            Authorization: `Bearer ${tokenCreds.idToken}`
          }
        };
        this.apigClient = apigClientFactory.newClient({
          region,
          accessKey: '',
          invokeUrl: serviceEndpointUri,
          secretKey: ''
        });
      } else {
        throw Error('Unsupported credential type in UserManagementApi');
      }
    }
  }

  public createUserPool(tenantId: string) {
    const params = {};
    const pathTemplate = '/admin/userpools';
    const method = 'POST';
    const additionalParams = {};
    const body = { tenant_id: tenantId };

    return this.apigClient.invokeApi(
      params,
      pathTemplate,
      method,
      additionalParams,
      body
    );
  }

  public deleteUserPool(id: string) {
    const params = {};
    const pathTemplate = `/admin/userpools/${id}`;
    const method = 'DELETE';
    const additionalParams = {};
    const body = {};

    return this.apigClient.invokeApi(
      params,
      pathTemplate,
      method,
      additionalParams,
      body
    );
  }

  public getUserPools() {
    const params = {};
    const pathTemplate = '/userpools';
    const method = 'GET';
    // var additionalParams = {};
    const body = {};

    return this.apigClient.invokeApi(
      params,
      pathTemplate,
      method,
      this.additionalParams,
      body
    );
  }

  public createUser(
    tenantId: string,
    userName: string,
    password: string,
    firstName: string,
    lastName: string,
    suppressInviteEmail: boolean = false,
    role?: string
  ) {
    const params = {};
    const pathTemplate = '/admin/users';
    const method = 'POST';
    const additionalParams = {};
    const body = { userName, password, firstName, lastName, suppressInviteEmail, role, tenant_id: tenantId };

    return this.apigClient.invokeApi(
      params,
      pathTemplate,
      method,
      additionalParams,
      body
    );
  }

  public registerTenant(
    tenantName: string,
    userName: string,
    firstName: string,
    lastName: string
  ) {
    const params = {};
    const pathTemplate = '/tenant/register';
    const method = 'POST';
    const additionalParams = {};
    const body = { tenantName, userName, firstName, lastName };

    return this.apigClient.invokeApi(
      params,
      pathTemplate,
      method,
      additionalParams,
      body
    );
  }

  public deleteUser(userName: string) {
    const params = {};
    const pathTemplate = `/admin/users/${encodeURIComponent(userName)}`;
    const method = 'DELETE';
    const additionalParams = {};
    const body = {};

    return this.apigClient.invokeApi(
      params,
      pathTemplate,
      method,
      additionalParams,
      body
    );
  }

  public getUserPoolByUserName(userName: string): Promise<{}> {
    const params = {};
    const pathTemplate = `/users/${encodeURIComponent(userName)}/pool`;
    const method = 'GET';
    const additionalParams = {};
    const body = {};

    return this.apigClient.invokeApi(
      params,
      pathTemplate,
      method,
      additionalParams,
      body
    );
  }

  public getUserInfo(userName: string) {
    const params = {};
    const pathTemplate = `/users/${encodeURIComponent(userName)}/info`;
    const method = 'GET';
    const body = {};

    return this.apigClient.invokeApi(
      params,
      pathTemplate,
      method,
      this.additionalParams,
      body
    );
  }

  public getUsers(firstNameSearch: string) {
    // eslint-disable-line
    // TODO: implement search parameters
    const params = {};
    const pathTemplate = '/users';
    const method = 'GET';
    const body = {};

    return this.apigClient.invokeApi(
      params,
      pathTemplate,
      method,
      this.additionalParams,
      body
    );
  }
}
