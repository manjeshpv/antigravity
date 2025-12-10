const express = require('express');
const path = require('path');
const { runSimulation } = require('./services/simulation');
const utils = require('./services/utils');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Helper to parse common params
function getParams(req) {
    return {
        name: req.query.name || 'Guest',
        dob: req.query.date_of_birth || '01-01-1990',
        sip: parseInt(req.query.sip) || 300000,
        // Helper to preserve other params when generating links
        query: req.query
    };
}

// Calculate Age
function calculateAge(dobStr) {
    try {
        const [d, m, y] = dobStr.split('-');
        const dob = new Date(`${y}-${m}-${d}`);
        const ageDiff = Date.now() - dob.getTime();
        const ageDate = new Date(ageDiff);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    } catch {
        return '--';
    }
}

// Routes

app.get('/', (req, res) => {
    const params = getParams(req);
    const startYear = 2025;
    const simData = runSimulation({ startYear, years: 15, sipAmount: params.sip });

    // Invested Amount
    const investedAmount = simData.transactions
        .filter(tx => tx.description === 'SIP Investment')
        .reduce((sum, tx) => sum + tx.amount, 0);

    // Generate Summary Rows
    const summaryRows = [];
    for (let i = 1; i <= 15; i++) {
        const year = startYear + i;
        const cutoffDate = new Date(`${year}-10-30`);

        // Helper to get Balance + XIRR
        const getMetrics = (accId) => {
            const balance = simData.transactions
                .filter(tx => tx.accountId === accId && new Date(tx.date) <= cutoffDate)
                .reduce((sum, tx) => sum + tx.amount, 0);

            const stream = simData.transactions
                .filter(tx =>
                    tx.accountId === accId &&
                    new Date(tx.date) <= cutoffDate &&
                    ['SIP Investment', 'Reinvestment', 'Payout', 'Deepavali Cashout'].includes(tx.description)
                )
                .map(tx => {
                    let amt = 0;
                    if (tx.description === 'SIP Investment' || tx.description === 'Reinvestment') {
                        amt = -tx.amount;
                    } else if (tx.description === 'Payout') {
                        amt = -tx.amount; // - (-val) = +val
                    }
                    return { date: tx.date, amount: amt };
                });

            if (balance > 0) {
                stream.push({ date: cutoffDate.toISOString().split('T')[0], amount: balance });
            }

            const xirr = utils.calculateXIRR(stream);
            return { balance, xirr };
        };

        const pp5 = getMetrics('pp5');
        const pp10 = getMetrics('pp10');
        const pp15 = getMetrics('pp15');

        const cashout = simData.cashouts.find(c => c.year === year);
        const cashoutAmt = cashout ? cashout.amount : 0;

        summaryRows.push({
            yearIndex: i,
            year,
            pp5,
            pp10,
            pp15,
            cashout: cashoutAmt
        });
    }

    // Strategy Details
    const part = Math.round(params.sip / 3);
    const strategy = {
        pp5Sip: part * 2,
        pp10Sip: part
    };

    res.render('index', {
        userParams: params,
        age: calculateAge(params.dob),
        investedAmount,
        summaryRows,
        strategy,
        utils // Pass utils to view
    });
});

app.get('/breakup', (req, res) => {
    const params = getParams(req);
    const startYear = 2025;
    const simData = runSimulation({ startYear, years: 15, sipAmount: params.sip });

    // Filter by Year
    const selectedYear = req.query.year || (startYear + 1); // Default Year 1

    // Pass ALL data or Just Filtered?
    // In view we implemented filtering, but actually view logic seemed to assume full list or passed "interestBreakup". 
    // In view: `interestBreakup.filter(...)` inside the EJS.
    // Wait, my breakup.ejs does: `interestBreakup.filter(item => item.date.startsWith(filterYear))`
    // But `filterYear` comes from `selectedYear` variable passed to view?
    // In breakup.ejs: `<% interestBreakup.forEach... %>` then manual filter?
    // Ah, Step 250: `interestBreakup.filter(item => item.date.startsWith(filterYear))`
    // So I need to pass `filterYear` (as string) and `interestBreakup` (full list) TO THE VIEW.

    // Actually, passing everything is fine.

    res.render('breakup', {
        userParams: params,
        interestBreakup: simData.interestBreakup,
        selectedYear,
        utils
    });
});

app.get('/transactions', (req, res) => {
    const params = getParams(req);
    const startYear = 2025;
    const simData = runSimulation({ startYear, years: 15, sipAmount: params.sip });

    // Filter by Account
    const selectedAccount = req.query.account || req.query.accountId || 'all';

    let filteredTransactions = simData.transactions;
    if (selectedAccount !== 'all') {
        filteredTransactions = simData.transactions.filter(tx => tx.accountId === selectedAccount);
    }

    // Sort
    filteredTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.render('transactions', {
        userParams: params,
        transactions: filteredTransactions,
        accounts: simData.accounts,
        selectedAccount,
        utils
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
