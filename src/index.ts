import { LogEntry } from 'winston';
import { deleteMessage } from './deleteMessage';

export { deleteMessage } from './deleteMessage';

const minuteDiff = (start: number) => {
  const millis = (new Date().getTime() - start);
  return (millis / 60000);
}

const deleteCallback = (message: any) => {
  console.debug(JSON.stringify(msg));
  const sender = message.notification[0].sender;
  const date = new Date(message.notification[4]);
  return (sender == "fake_outbound_mms" && minuteDiff(date.getTime()) > 15);
}

const loopValCallback = (message: any) => message.content.id;

deleteMessage("amqp://localhost:15672", "sendqueue", deleteCallback, loopValCallback);