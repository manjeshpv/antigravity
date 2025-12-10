const fs = require('fs');

// --- Enum Definitions ---
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
    TRANSFER: 'Transfer'
};

// --- Accounts Data ---
const accounts = [
    { id: 'sbi', name: 'SBI Salary Account', type: AccountType.BANK },
    { id: 'pp5', name: 'Zerodha Coin - Parag Parikh 5% returns fund', type: AccountType.MUTUAL_FUND },
    { id: 'pp10', name: 'Zerodha Coin - Parag Parikh 10% returns fund', type: AccountType.MUTUAL_FUND },
    { id: 'pp15', name: 'Zerodha Coin - Parag Parikh 15% returns fund', type: AccountType.MUTUAL_FUND },
    { id: 'interest_income', name: 'Interest Account', type: AccountType.INCOME }
];

const transactions = [];
const lots15 = []; // To track lots for 15% fund { date, amount }
const interestBreakup = []; // To track detailed interest calc { date, lotDate, lotAmount, days, interest }

// Helper to add transaction
function addTransaction(date, description, amount, accountId) {
    transactions.push({
        id: transactions.length + 1,
        date: date.toISOString().split('T')[0], // YYYY-MM-DD
        description,
        amount,
        accountId
    });
}

// --- Simulation Logic ---
const startDate = new Date('2025-04-01');
const endDate = new Date('2027-03-31');
const sipStartDate = new Date('2025-11-01');

// Opening Balance
addTransaction(startDate, TransactionType.OPENING_BALANCE, 7200000, 'sbi');

let currentDate = new Date(startDate);
let balance5 = 0;
let balance10 = 0;

while (currentDate <= endDate) {
    const day = currentDate.getDate();
    const month = currentDate.getMonth(); // 0-11

    // SIPs: 1st of every month starting Nov 2025
    if (day === 1 && currentDate >= sipStartDate) {
        // SBI -> SIPs
        addTransaction(currentDate, TransactionType.SIP_DEBIT, -300000, 'sbi');

        // 5% Fund Investment
        addTransaction(currentDate, TransactionType.SIP_CREDIT, 200000, 'pp5');
        balance5 += 200000;

        // 10% Fund Investment
        addTransaction(currentDate, TransactionType.SIP_CREDIT, 100000, 'pp10');
        balance10 += 100000;

        // 5% Fund Payout Logic (Monthly)
        // Payout on the PRINCIPAL held before this month? Or including?
        // Logic: "invested... which will give monthly payout". 
        // If I invest on 1st, and get payout "monthly", let's assume immediate payout on 1st as simple model or end of month.
        // Previous logic: "Payout base = Balance - 200k" (Arrears).
        // Let's stick to previous logic: Pay out on the balance held *before* today's SIP (if any).
        // Actually, if we stick to "end of first month" rule properly, it should be next month. 
        // But for simplicity in previous step we did (balance - currentSIP).

        const payoutBase = balance5 - 200000;
        if (payoutBase > 0) {
            const monthlyPayout = Math.round((payoutBase * 0.05) / 12);
            if (monthlyPayout > 0) {
                // 1. Interest Income: Debit Interest Account, Credit 5% Fund
                // Wait, Interest Account is Income. 
                // Accounting: Debit Fund (Asset Increase), Credit Interest Income (Income Increase).
                // But here we want to show the specific entries for *that account*.
                // User said: "add one opposite entry(interest credit as income) to 5% and 10% funds"
                // So in 'pp5': Credit "Interest Income".
                // In 'interest_income' account: Debit? (To balance).
                addTransaction(currentDate, TransactionType.INTEREST_INCOME, -monthlyPayout, 'interest_income');
                addTransaction(currentDate, TransactionType.INTEREST_INCOME, monthlyPayout, 'pp5');

                // 2. Payout: Debit 5% Fund, Credit Reinvestment?
                // Flow: 5% Fund Payout -> Reinvest in 15% Fund.
                // Debit 'pp5' (Money leaves).
                addTransaction(currentDate, TransactionType.PAYOUT, -monthlyPayout, 'pp5');

                // Credit 'pp15' (Money enters)
                addTransaction(currentDate, TransactionType.REINVESTMENT, monthlyPayout, 'pp15');

                // Track 15% Lot
                lots15.push({ date: new Date(currentDate), amount: monthlyPayout });
            }
        }
    }

    // 10% Fund Payout Logic (Oct 30th)
    if (month === 9 && day === 30) {
        if (balance10 > 0) {
            const annualPayout = Math.round(balance10 * 0.10);

            // Interest Income
            addTransaction(currentDate, TransactionType.INTEREST_INCOME, -annualPayout, 'interest_income');
            addTransaction(currentDate, TransactionType.INTEREST_INCOME, annualPayout, 'pp10');

            // Payout
            addTransaction(currentDate, TransactionType.PAYOUT, -annualPayout, 'pp10');

            // Reinvestment
            addTransaction(currentDate, TransactionType.REINVESTMENT, annualPayout, 'pp15');

            // Track 15% Lot
            lots15.push({ date: new Date(currentDate), amount: annualPayout });
        }

        // --- 15% Fund Interest Calculation (Lot-wise) ---
        // "Oct 30th add interest of 15% for the last 1 year"
        // Iterate all 15% lots.
        let totalInterest15 = 0;

        // We need to handle the fact that lots might be added *on* Oct 30 (just above).
        // Should they get interest immediately? No.
        // So we should iterate lots existing *before* today? or just calculate days.
        // If days = 0, interest = 0.

        lots15.forEach(lot => {
            // Calculate days held since lot date OR last calculation date?
            // "interest of 15% for the last 1 year".
            // If lot is older than 1 year, we pay 1 year interest?
            // Or is it Cumulative? 
            // "add interest... for the last 1 year".
            // Typically means Annual Interest Credit.
            // If lot is new (e.g. from Dec 1 2025), and today is Oct 30 2026.
            // Interest = Amount * 15% * (Dec->Oct / 365).
            // If lot is old (e.g. from 2020), Interest = Amount * 15% * 1.

            // We need to track "lastInterestDate" for each lot to avoid double counting?
            // The prompt implies "add interest". Does it Reinvest (Compound)?
            // "add... interest". 
            // Usually simpler: Check if lot was present. 
            // Let's assume Simple Interest credited annually on Capital?
            // "Opening Balance... - interest for this year...".
            // User requested "breakup" view.

            // Let's calculate interest for the period: [Max(LotDate, LastOct30) -> CurrentOct30].
            const lastOct30 = new Date(currentDate.getFullYear() - 1, 9, 30);
            const startDateCalc = lot.date > lastOct30 ? lot.date : lastOct30;

            // If Lot Date is TODAY (new reinvestment), strict greater check handles it, or diff is 0.
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
            // Credit Interest to 15% Fund (Growth)
            // "add interest...". It increases the value.
            // Debit Interest Account -> Credit 15% Fund.
            addTransaction(currentDate, TransactionType.INTEREST_INCOME, -totalInterest15, 'interest_income');
            addTransaction(currentDate, TransactionType.INTEREST_INCOME, totalInterest15, 'pp15');

            // Does this interest become a new LOT? Compounding?
            // Usually yes.
            lots15.push({ date: new Date(currentDate), amount: totalInterest15 });
        }
    }

    currentDate.setDate(currentDate.getDate() + 1);
}

// --- Output Generation ---
const db = {
    accounts,
    transactions,
    interestBreakup
};

const fileContent = `window.db = ${JSON.stringify(db, null, 2)};`;

fs.writeFileSync('db.js', fileContent);
console.log('✅ Data generated in db.js');
console.log(`Total Transactions: ${transactions.length}`);
console.log(`15% Fund Lots: ${lots15.length}`);
