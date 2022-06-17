import amqp, { Connection } from 'amqplib';
import { rejects } from 'assert';
import wait from 'waait';
import { MessageChannel } from 'worker_threads';
import { initLoggers } from './logger';

const TIMEOUT = parseInt(`${process.env.RABBITMQ_DELETE_MESSAGE_TIMEOUT}`, 10) || 1000;

// const dones: string[] = [];
let stopped = false;

const logger = initLoggers();

export interface ProcessingInstruction {
  delete: Boolean,
  continue: Boolean
}
export type CheckMessage = (message: any) => ProcessingInstruction;

export async function deleteMessage(serverURL: string, queueName: string, checkMessage: CheckMessage): Promise<number> {
  let deleteCount: number = 0;

  const connection = await amqp.connect(serverURL);
  const channel = await connection.createConfirmChannel();

  let timeoutHandle: NodeJS.Timeout | null = null;
  return new Promise((resolve, reject) => {
    try {
      channel
        .consume(queueName, async (message) => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }

          timeoutHandle = setTimeout( _ =>  {
            channel.close();
            connection.close();
      
            return reject("no message received in 1.5s");
          }, 1500);

          if (message) {
            // checking to see if there is a message to delete
            try {
              const instruction = checkMessage(message.content);
              if (instruction.delete) {
                channel.ack(message); // dequeue message and continue
                deleteCount += 1;
              } else {
                channel.nack(message, false, true); // requeue the message and continue
              }

              if (!instruction.continue) {
                channel.close();
                connection.close();
                return resolve(deleteCount);
              }
            } catch (e) {
              channel.close();
              connection.close();
              return reject(e);
            }
          } else {
            channel.close();
            connection.close();
            return reject(`Message is not defined`);
            // channel.nack(message, false, true); // requeue the message and continue
          }
        })
        .catch((er) => {
          console.error(`an error occurred ${er}`);
          return reject(er);
        });
    } catch (error) {
      console.error(`an error occurred ${error}`);
      return reject(error);
    }
  });
}
