/* eslint-disable @typescript-eslint/no-explicit-any */
import amqp from 'amqplib';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { deleteMessage, ProcessingInstruction } from '../src/deleteMessage';

const defaultProcessingInstruction: ProcessingInstruction = { delete: true, continue: false };
describe('Delete message', () => {
  let sandbox: sinon.SinonSandbox;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => sandbox.restore());

  it('should rejects if unable to connect to the server', async () => {
    /** GIVEN */
    const expectedError = new Error('Connection Error');

    sandbox.stub(amqp, 'connect').rejects(expectedError);

    const serverURL = 'amqp://local';
    const queueName = 'MY_QUEUE';
    const messageId = '2f5b752e-d6e1-4561-af69-1224a1888de1';

    /** WHEN */
    try {
      await deleteMessage(serverURL, queueName, _ => defaultProcessingInstruction);
    } catch (error) {
      /** THEN */
      expect(error).to.equal(expectedError);
    }
  });

  it('should rejects if unable to create a channel', async () => {
    /** GIVEN */
    const expectedError = new Error('Channel Error');
    const connection = {
      createConfirmChannel: sandbox.stub().rejects(expectedError)
    };

    sandbox.stub(amqp, 'connect').resolves(connection as any);

    const serverURL = 'amqp://local';
    const queueName = 'MY_QUEUE';
    const messageId = '2f5b752e-d6e1-4561-af69-1224a1888de1';

    /** WHEN */
    try {
      await deleteMessage(serverURL, queueName, _ => defaultProcessingInstruction);
    } catch (error) {
      /** THEN */
      expect(error).to.equal(expectedError);
    }
  });

  it('should rejects if consuming throws', async () => {
    /** GIVEN */
    const expectedError = new Error('Consume Error');

    const channel = {
      consume: sandbox.stub().throws(expectedError)
    };

    const connection = {
      createConfirmChannel: sandbox.stub().resolves(channel)
    };

    sandbox.stub(amqp, 'connect').resolves(connection as any);

    const serverURL = 'amqp://local';
    const queueName = 'MY_QUEUE';
    const messageId = '2f5b752e-d6e1-4561-af69-1224a1888de1';

    /** WHEN */
    try {
      await deleteMessage(serverURL, queueName, _ => defaultProcessingInstruction);
    } catch (error) {
      /** THEN */
      expect(error).to.equal(expectedError);
    }
  });

  it('Should rejects if message is null', async () => {
    /** GIVEN */
    const serverURL = 'amqp://local';
    const queueName = 'MY_QUEUE';
    const messageId = '2f5b752e-d6e1-4561-af69-1224a1888de1';
    const message = null;
    const consumeStub = sandbox.stub();
    consumeStub.callsArgWith(1, message);

    // we should call consume's callback
    const channel = {
      consume: consumeStub,
      ack: sandbox.stub(),
      nack: sandbox.stub(),
      cancel: sandbox.stub(),
      close: sandbox.stub()
    };
    const connection = {
      createConfirmChannel: sandbox.stub().resolves(channel),
      close: sandbox.stub()
    };
    sandbox.stub(amqp, 'connect').resolves(connection as any);

    /** when */
    try {
      await deleteMessage(serverURL, queueName, _ => defaultProcessingInstruction);
    } catch (error) {
      /** THEN */
      expect(error).to.equal('Message is not defined');
    }
  });

  it('Should rejects if error "acking" the message', async () => {
    /** GIVEN */
    const serverURL = 'amqp://local';
    const queueName = 'MY_QUEUE';
    const messageId = '2f5b752e-d6e1-4561-af69-1224a1888de1';
    const message = {
      properties: {
        messageId
      },
      fields: {
        consumerTag: '&é"'
      },
      content: {
        foo: "bar",
        baz: "quux"
      }
    };
    const consumeStub = sandbox.stub();
    consumeStub.callsArgWith(1, message);

    // we should call consume's callback
    const channel = {
      consume: consumeStub,
      ack: sandbox.stub().throws(new Error('channel.ack.error')),
      nack: sandbox.stub(),
      cancel: sandbox.stub(),
      close: sandbox.stub()
    };
    const connection = {
      createConfirmChannel: sandbox.stub().resolves(channel),
      close: sandbox.stub()
    };
    sandbox.stub(amqp, 'connect').resolves(connection as any);

    /** when */
    try {
      await deleteMessage(serverURL, queueName, _ => defaultProcessingInstruction);
    } catch (error) {
      /** then */
      expect(error.message).to.equal('channel.ack.error');
    }
  });

  it('Should rejects if error "nacking" the message', async () => {
    /** GIVEN */
    const serverURL = 'amqp://local';
    const queueName = 'MY_QUEUE';
    const messageId = '2f5b752e-d6e1-4561-af69-1224a1888de2';
    const message = {
      properties: {
        messageId
      },
      fields: {
        consumerTag: '&é"'
      },
      content: {
        foo: "bar",
        baz: "quux"
      }
    };
    const consumeStub = sandbox.stub();
    consumeStub.callsArgWith(1, message);

    // we should call consume's callback
    const channel = {
      consume: consumeStub,
      ack: sandbox.stub(),
      nack: sandbox.stub().throws(new Error('channel.nack.error')),
      cancel: sandbox.stub(),
      close: sandbox.stub()
    };
    const connection = {
      createConfirmChannel: sandbox.stub().resolves(channel),
      close: sandbox.stub()
    };
    sandbox.stub(amqp, 'connect').resolves(connection as any);

    /** when */
    try {
      const pi = { delete: false, continue: true };
      await deleteMessage(serverURL, queueName, _ => pi);
    } catch (error) {
      /** then */
      expect(error.message).to.equal('channel.nack.error');
    }
  });

  it('Should return message if message found and deleted', async () => {
    /** GIVEN */
    const serverURL = 'amqp://local';
    const queueName = 'MY_QUEUE';
    const messageId = '2f5b752e-d6e1-4561-af69-1224a1888de1';
    const message = {
      properties: {
        messageId
      },
      fields: {
        consumerTag: '&é"'
      },
      content: {
        foo: "bar",
        baz: "quux"
      }
    };
    const consumeStub = sandbox.stub();
    consumeStub.callsArgWith(1, message);

    // we should call consume's callback
    const channel = {
      consume: consumeStub,
      ack: sandbox.stub(),
      nack: sandbox.stub(),
      cancel: sandbox.stub(),
      close: sandbox.stub()
    };
    const connection = {
      createConfirmChannel: sandbox.stub().resolves(channel),
      close: sandbox.stub()
    };
    sandbox.stub(amqp, 'connect').resolves(connection as any);

    /** when */
    const response = await deleteMessage(serverURL, queueName, msg => {
      return {
        delete: msg.foo == "bar",
        continue: false
      }
    });

    /** then */
    expect(response).to.equal(1);
  });

  it ('Should timeout if no message are received', async() => {
    const serverURL = 'amqp://local';
    const queueName = 'MY_QUEUE';
    const messageId = '2f5b752e-d6e1-4561-af69-1224a1888de1';
    const message = {
      properties: {
        messageId
      },
      fields: {
        consumerTag: '&é"'
      },
      content: {
        foo: "bar",
        baz: "quux"
      }
    };
   
    const consumeStub = sandbox.stub();
    consumeStub.callsArgWith(1, message);

    // we should call consume's callback
    const channel = {
      consume: consumeStub,
      ack: sandbox.stub(),
      nack: sandbox.stub(),
      cancel: sandbox.stub(),
      close: sandbox.stub()
    };
    const connection = {
      createConfirmChannel: sandbox.stub().resolves(channel),
      close: sandbox.stub()
    };
    sandbox.stub(amqp, 'connect').resolves(connection as any);

    /** when */
    try {
      const response = await deleteMessage(serverURL, queueName, msg => {
        return {
          delete: msg.foo == "bar",
          continue: true
        }
      });
    } catch (err) {
      /** then */
      expect(err).to.equal("no message received in 1.5s");
      
    }

  });
});
