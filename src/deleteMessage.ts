import amqp from 'amqplib';
import wait from 'waait';
import { initLoggers } from './logger';

const TIMEOUT = parseInt(`${process.env.RABBITMQ_DELETE_MESSAGE_TIMEOUT}`, 10) || 1000;

// const dones: string[] = [];
let stopped = false;

const logger = initLoggers();

interface DeleteResponse {
  deleted: boolean;
  message?: amqp.ConsumeMessage;
}

let connection: amqp.Connection | null = null;
let channel: amqp.ConfirmChannel | null = null;

async function createChannel(serverURL: string): Promise<void> {
  if (!connection) {
    connection = await amqp.connect(serverURL);
  }
  channel = await connection.createConfirmChannel();
}

// This is for test purpose, in order to reset connexioion
export function resetConnection(): void {
  connection = null;
  channel = null;
}

async function stopConsumerAndCloseChannel(consumerTag: string, channel: amqp.Channel): Promise<void> {
  stopped = true;
  await channel.cancel(consumerTag);
  await wait(TIMEOUT);

  if (stopped) {
    channel.close();
  }
  stopped = false;
}

export type DeleteCallback = (message: any) => Boolean;
export type LoopValCallback = (message: any) => any;

export async function deleteMessage(serverURL: string, queueName: string, shouldDelete: DeleteCallback, getLoopVal: LoopValCallback): Promise<number> {
  let loopVal: any = null;
  let deleteCount: number = 0;
  await createChannel(serverURL);
  return new Promise((resolve, reject) => {
    try {
      if (channel === null) {
        throw "Could not create RMQ channel";
      }

      channel
        .consume(queueName, async (message) => {
          if (stopped) {
            logger.debug(`Stopped already`);
            return;
          }

          if (message) {
            const loopValT = getLoopVal(message);
            if (loopVal === null) {
              console.debug(`setting loopVal ${loopVal} === ${loopValT}`);
              loopVal = loopValT
            } else if (loopVal === loopValT) {
              console.debug(`We looped`);
              // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
              // @ts-ignore
              await stopConsumerAndCloseChannel(message.fields.consumerTag, channel);
              resolve(deleteCount);
            }

            // checking to see if there is a message to delete
            try {
              if (channel === null) {
                return;
              }

              if (shouldDelete(message.content)) {
                console.debug(`acking message`);
                channel.ack(message); // dequeue message and continue
              } else {
                console.debug(`nacking message`);
                channel.nack(message, false, true); // requeue the message and continue
              }
            } catch (e) {
              // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
              // @ts-ignore
              await stopConsumerAndCloseChannel(message.fields.consumerTag, channel);
              return reject(e);
            }
          } else {
            /**
             * As we can not identify a message, we should stop, because
             * we will not be able to know when we looped
             */
            console.warn(`Message is not defined or not valid, it should have a messageId`);
            if (message) {
              // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
              // @ts-ignore
              await stopConsumerAndCloseChannel(message.fields.consumerTag, channel);
              throw new Error('Message is not valid, it should have a messageId');
            } else {
              // reject();
              throw new Error('Message is not defined');
            }
          }
        })
        .catch((er) => {
          logger.debug('Error ');
          logger.error(er);
          reject(er);
        });
    } catch (error) {
      logger.error(`${error}`);
      reject(error);
    }
  });
}
