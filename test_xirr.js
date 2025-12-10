const fs = require('fs');
// Mock window and db
const dbContent = fs.readFileSync('db.js', 'utf8');
const window = {};
eval(dbContent); // Load db into window.db

const { transactions } = window.db;

function calculateXIRR(cashFlows, guess = 0.1) {
    if (cashFlows.length === 0) return 0;

    const limit = 100;
    const tol = 1e-6;
    let xirr = guess;

    const startDate = new Date(cashFlows[0].date);

    for (let i = 0; i < limit; i++) {
        let fValue = 0;
        let fDerivative = 0;

        for (const { date, amount } of cashFlows) {
            const d = new Date(date);
            const days = (d - startDate) / (1000 * 60 * 60 * 24);
            const factor = Math.pow(1 + xirr, days / 365);

            fValue += amount / factor;
            fDerivative -= (amount * days) / (365 * factor * (1 + xirr));
        }

        if (Math.abs(fValue) < tol) return xirr;
        if (Math.abs(fDerivative) < 1e-9) return xirr;

        const newXirr = xirr - fValue / fDerivative;
        if (!isFinite(newXirr)) return xirr;
        if (Math.abs(newXirr - xirr) < tol) return newXirr;
        xirr = newXirr;
    }
    return xirr;
}

function getCashFlows(accountId, cutoffDate) {
    const stream = transactions
        .filter(tx =>
            tx.accountId === accountId &&
            new Date(tx.date) <= cutoffDate &&
            ['SIP Investment', 'Reinvestment', 'Payout'].includes(tx.description)
        )
        .map(tx => {
            let cfAmount = 0;
            if (tx.description === 'SIP Investment' || tx.description === 'Reinvestment') {
                cfAmount = -tx.amount;
            } else if (tx.description === 'Payout') {
                cfAmount = -tx.amount; // Payout is negative in DB, so -(-val) = +val
            }
            return { date: tx.date, amount: cfAmount, desc: tx.description };
        });

    const balance = transactions
        .filter(tx => tx.accountId === accountId && new Date(tx.date) <= cutoffDate)
        .reduce((sum, tx) => sum + tx.amount, 0);

    if (balance > 0) {
        stream.push({ date: cutoffDate.toISOString().split('T')[0], amount: balance, desc: 'Terminal' });
    }

    return stream.sort((a, b) => new Date(a.date) - new Date(b.date));
}

const xirrDate = new Date('2026-10-30');

console.log('--- PP5 ---');
const cf5 = getCashFlows('pp5', xirrDate);
console.log('Flows:', cf5.length);
console.log('XIRR:', calculateXIRR(cf5));

console.log('--- PP10 ---');
const cf10 = getCashFlows('pp10', xirrDate);
console.log('Flows:', cf10.length);
console.log('XIRR:', calculateXIRR(cf10));

console.log('--- PP15 ---');
const cf15 = getCashFlows('pp15', xirrDate);
console.log('Flows:', cf15.length);
console.log('XIRR:', calculateXIRR(cf15));
