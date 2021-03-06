import { ICognitoUserPoolLocator } from './ICognitoUserPoolLocator';
import * as AWS from 'aws-sdk/global';
import { ICognitoUserPoolApiModel } from './ICognitoUserPoolApiModel';
import {
    AuthenticationDetails,
    CognitoUser,
    CognitoUserPool,
    CognitoUserSession
} from 'amazon-cognito-identity-js';
const proxy = require('proxy-agent');
import { GlobalConfigInstance } from 'aws-sdk/lib/config';
// tslint:disable-next-line:no-duplicate-imports
import { CognitoIdentityCredentials } from 'aws-sdk/global';

export function configureAwsProxy(awsConfig: GlobalConfigInstance) {
  if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
    // TODO: does AWS support multiple proxy protocols simultaneously (HTTP and HTTPS proxy)
    // For now, this prefers HTTPS over HTTP proxy protocol for HTTPS requests
    let proxyUri = process.env.HTTP_PROXY;
    if (proxyUri === undefined) {
      proxyUri = process.env.HTTPS_PROXY;
    }
    awsConfig.update({
      httpOptions: { agent: proxy(proxyUri) }
    });
  }
}

export class AuthManager {
  public lastRefresh: number;
  private locator: ICognitoUserPoolLocator;
  private poolData: ICognitoUserPoolApiModel;
  private readonly region: string;
  private cognitoUser: CognitoUser;
  private cognitoUserSession: CognitoUserSession;
  private iamCredentials: CognitoIdentityCredentials;
  private authenticatorURI: string;

  constructor(
        locator: ICognitoUserPoolLocator,
        region: string
    ) {
    this.locator = locator;
    this.region = region;
    this.lastRefresh = 0;
    // AWS module configuration
    configureAwsProxy(AWS.config);
    AWS.config.region = region;
  }

  public signIn(email: string, password: string, newPassword: string = ''): Promise<CognitoUserSession> {
    return new Promise(async (resolve, reject) => {
      // get the pool data from the response
      console.log(`Signing into AWS Cognito`);
      try {
        this.poolData = await this.locator.getPoolForUsername(email);
        this.authenticatorURI = `cognito-idp.${this.region}.amazonaws.com/${this.poolData.UserPoolId}`;
      } catch (error) {
        return reject(error);
      }
      // construct a user pool object
      const userPool = new CognitoUserPool(this.poolData);
      // configure the authentication credentials
      const authenticationData = {
        Password: password,
        Username: email.toLowerCase()
      };
      // create object with user/pool combined
      const userData = {
        Pool: userPool,
        Username: email.toLowerCase()
      };
      // init Cognito auth details with auth data
      const authenticationDetails = new AuthenticationDetails(authenticationData);
      // authenticate user to in Cognito user pool
      this.cognitoUser = new CognitoUser(userData);
      // tslint:disable-next-line:no-this-assignment
      const that = this;
      this.cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess(result) {
          that.cognitoUserSession = result;
          return resolve(result);
        },
        onFailure(err) {
          return reject(err);
        },
        mfaRequired(codeDeliveryDetails) { // eslint-disable-line
          return reject(Error('Multi-factor auth is not currently supported'));
        },
        newPasswordRequired(userAttributes, requiredAttributes) { // eslint-disable-line
          if (newPassword) {
            // User was signed up by an admin and must provide new
            // password and required attributes
            // These attributes are not mutable and should be removed from map.
            delete userAttributes.email_verified;
            delete userAttributes['custom:tenant_id'];
            that.cognitoUser.completeNewPasswordChallenge(newPassword, userAttributes, {
              onFailure: (err) => {
                return reject(err);
              },
              onSuccess: (result) => {
                that.cognitoUserSession = result;
                return resolve(result);
              }
            });
          } else {
            return reject(Error('New password is required for the user'));
          }
        }
      });
    });
  }

  public async getAndSetEnvironmentCredentials() {
    const creds = await this.getCognitoCredentials();
    this.setEnvironmentIAMCreds(this.iamCredentials);
    return creds;
  }

  public getCognitoCredentials(): Promise<any> {
    return new Promise((res, rej) => {
      this.lastRefresh = (new Date()).getTime();
      const { refreshToken } = this.getTokens(this.cognitoUserSession);
      this.cognitoUser.refreshSession(refreshToken, (err, session) => {
        if (err) {
          rej(err);
        } else {
          const tokens = this.getTokens(session);
          this.iamCredentials = this.buildCognitoIdentityCredentials(tokens);
          (this.iamCredentials as CognitoIdentityCredentials).get((error) => {
            if (error) {
              rej(error);
            } else {
              console.log(`New credential expiry: ${this.iamCredentials.expireTime}`);
              res(this.iamCredentials);
            }
          });
        }
      });
    });
  }

  public setEnvironmentIAMCreds(creds: CognitoIdentityCredentials) {
    process.env.AWS_ACCESS_KEY_ID = creds.accessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = creds.secretAccessKey;
    process.env.AWS_SESSION_TOKEN = creds.sessionToken;
    console.log('Successfully set fresh environment IAM credentials.');
  }

  private buildCognitoIdentityCredentials(tokens): CognitoIdentityCredentials {
    return new CognitoIdentityCredentials({
      IdentityPoolId: this.poolData.IdentityPoolId,
      Logins: {
        [this.authenticatorURI]: tokens.idToken.getJwtToken()
      }
    });
  }

  private getTokens(session) {
    return {
      accessToken: session.getAccessToken(),
      idToken: session.getIdToken(),
      refreshToken: session.getRefreshToken()
    };
  }
}
