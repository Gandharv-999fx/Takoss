import { TakossAPIServer } from '../src/api/server';

const server = new TakossAPIServer(3000);

server.start().catch(console.error);
