import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.ts';

const app = createServer();

async function makeARequest(question: string) {
    return await app.inject({
        method: 'POST',
        url: '/chat',
        payload: {
            question,
        },
    });
}

describe('Restaurant Booking System - E2E Tests', async () => {

    it('Reserve table - Success', async () => {
        const response = await makeARequest(
            'Olá, quero reservar uma mesa para 2 pessoas amanhã às 20h, me chamo Carlos Andrade'
        );

        console.log('Reserve Success Response:', response.body);

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.intent, 'reserve');
        assert.equal(body.actionSuccess, true);
    });

    it('Cancel reservation - Success', async () => {
        // First create a reservation to cancel
        await makeARequest(
            'Quero reservar uma mesa para 2 pessoas hoje às 19h, me chamo Pedro Souza'
        );

        const response = await makeARequest(
            'Cancelar minha reserva de hoje às 19h, me chamo Pedro Souza'
        );

        console.log('Cancel Success Response:', response.body);

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.intent, 'cancel');
        assert.equal(body.actionSuccess, true);
    });

    it('Unknown intent - Returns graceful response', async () => {
        const response = await makeARequest(
            'Vocês têm opções vegetarianas no cardápio?'
        );

        console.log('Unknown Intent Response:', response.body);

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.intent, 'unknown');
    });

    it('Reserve table outside service hours - Returns error', async () => {
        const response = await makeARequest(
            'Quero reservar uma mesa para 3 pessoas hoje às 10h (café da manhã), me chamo Lucas Lima'
        );

        console.log('Out of Hours Response:', response.body);

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.intent, 'reserve');
        assert.equal(body.actionSuccess, false);
    });

});
