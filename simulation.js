// Simulation Logic

const AccountType = {
    BANK: 'Bank Account',
    MUTUAL_FUND: 'Mutual Fund',
    INCOME: 'Income Account'
};

const TransactionType = {
    OPENING_BALANCE: 'Opening Balance',
    SIP_DEBIT: 'SIP Installment',
    SIP_CREDIT: 'SIP Investment',
    PAYOUT: 'Payout',
    INTEREST_INCOME: 'Interest Income',
    REINVESTMENT: 'Reinvestment',
    CASHOUT: 'Deepavali Cashout'
};

function runSimulation(params) {
    const { startYear = 2025, years = 15, sipAmount = 300000 } = params;

    // Calculate Split (2:1 Ratio)
    // 2 parts to PP5, 1 part to PP10
    // Total 3 parts.
    const part = Math.round(sipAmount / 3);
    const pp5Sip = part * 2;
    const pp10Sip = part;

    // Setup Accounts
    const accounts = [
        { id: 'sbi', name: 'SBI Salary Account', type: AccountType.BANK },
        { id: 'pp5', name: 'Parag Parikh 5% Account (PP5)', type: AccountType.MUTUAL_FUND },
        { id: 'pp10', name: 'Parag Parikh 10% Account (PP10)', type: AccountType.MUTUAL_FUND },
        { id: 'pp15', name: 'Parag Parikh 15% Account (PP15)', type: AccountType.MUTUAL_FUND },
        { id: 'interest_income', name: 'Interest Account', type: AccountType.INCOME }
    ];

    const transactions = [];
    const lots15 = []; // { date, amount }
    const interestBreakup = []; // { date, lotDate, lotAmount, days, interest }
    const cashouts = []; // { date, amount, accountId }

    let txIdCounter = 1;

    function addTx(date, description, amount, accountId, relatedAccountId = null) {
        transactions.push({
            id: txIdCounter++,
            date: date.toISOString().split('T')[0],
            description,
            amount,
            accountId,
            relatedAccountId
        });
    }

    // --- Simulation Parameters ---
    let currentDate = new Date(`${startYear}-04-01`);
    const endDate = new Date(currentDate);
    endDate.setFullYear(endDate.getFullYear() + years);

    const sipStartDate = new Date(`${startYear}-11-01`);

    // Opening Balance
    addTx(currentDate, TransactionType.OPENING_BALANCE, 7200000, 'sbi');

    // Tracking Balances (Simplified)
    let balance5 = 0;
    let balance10 = 0;

    // Loop Day by Day
    while (currentDate <= endDate) {
        const day = currentDate.getDate();
        const month = currentDate.getMonth(); // 0-11
        const year = currentDate.getFullYear();

        // SIPs: 1st of every month starting Nov 2025
        if (day === 1 && currentDate >= sipStartDate) {
            // SBI Debit (Total)
            addTx(currentDate, TransactionType.SIP_DEBIT, -sipAmount, 'sbi');

            // 5% Fund Investment
            addTx(currentDate, TransactionType.SIP_CREDIT, pp5Sip, 'pp5');
            balance5 += pp5Sip;

            // 10% Fund Investment
            addTx(currentDate, TransactionType.SIP_CREDIT, pp10Sip, 'pp10');
            balance10 += pp10Sip;

            // 5% Fund Monthly Payout Logic
            const payoutBase = balance5 - pp5Sip; // Payout on prev balance
            if (payoutBase > 0) {
                const monthlyPayout = Math.round((payoutBase * 0.05) / 12);
                if (monthlyPayout > 0) {
                    // Interest Income
                    addTx(currentDate, TransactionType.INTEREST_INCOME, -monthlyPayout, 'interest_income', 'pp5');
                    addTx(currentDate, TransactionType.INTEREST_INCOME, monthlyPayout, 'pp5', 'interest_income');

                    // Payout -> Reinvest to 15%
                    addTx(currentDate, TransactionType.PAYOUT, -monthlyPayout, 'pp5', 'pp15');
                    addTx(currentDate, TransactionType.REINVESTMENT, monthlyPayout, 'pp15', 'pp5');

                    lots15.push({ date: new Date(currentDate), amount: monthlyPayout });
                }
            }
        }

        // 10% Fund Annual Payout Logic (Oct 30th) - DEEPAVALI CASHOUT
        if (month === 9 && day === 30) {
            if (balance10 > 0) {
                const annualPayout = Math.round(balance10 * 0.10);

                // Interest Income
                addTx(currentDate, TransactionType.INTEREST_INCOME, -annualPayout, 'interest_income', 'pp10');
                addTx(currentDate, TransactionType.INTEREST_INCOME, annualPayout, 'pp10', 'interest_income');

                // Payout -> Cashout (NOT Reinvested)
                addTx(currentDate, TransactionType.PAYOUT, -annualPayout, 'pp10');
                // Note: We don't credit any other account, effectively withdrawn from system. 
                // Or maybe credit SBI?
                // "Total Cashout on deepvali" implies user takes it.
                // Let's log it specifically as 'Deepavali Cashout' logic check?
                // Payout reduces PP10 balance (implicitly handled by transaction list if we sum, but we track balance10 manually? No, balance10 is principal invested?)
                // Wait, balance10 variable only tracks CAPITAL invested via SIPs.
                // Does Payout reduce Capital? No, it's Interest Payout.
                // So balance10 stays same.

                cashouts.push({
                    year: year,
                    date: new Date(currentDate),
                    amount: annualPayout
                });
            }

            // 15% Fund Annual Interest Compounding (Oct 30th)
            let totalInterest15 = 0;
            const lastOct30 = new Date(currentDate.getFullYear() - 1, 9, 30);

            lots15.forEach(lot => {
                const startDateCalc = lot.date > lastOct30 ? lot.date : lastOct30;
                const diffTime = currentDate - startDateCalc;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays > 0) {
                    const interest = Math.round(lot.amount * 0.15 * (diffDays / 365));
                    if (interest > 0) {
                        totalInterest15 += interest;
                        interestBreakup.push({
                            date: currentDate.toISOString().split('T')[0],
                            lotDate: lot.date.toISOString().split('T')[0],
                            lotAmount: lot.amount,
                            days: diffDays,
                            interest
                        });
                    }
                }
            });

            if (totalInterest15 > 0) {
                // Credit Interest (Growth)
                addTx(currentDate, TransactionType.INTEREST_INCOME, -totalInterest15, 'interest_income', 'pp15');
                addTx(currentDate, TransactionType.INTEREST_INCOME, totalInterest15, 'pp15', 'interest_income');

                // Compounding: Interest adds to capital base (new lot)
                lots15.push({ date: new Date(currentDate), amount: totalInterest15 });
            }
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
        accounts,
        transactions,
        interestBreakup,
        cashouts,
        lots15
    };
}

window.simulation = {
    runSimulation
};
