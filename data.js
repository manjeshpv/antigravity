
const accounts = [
    { id: 'sbi', name: 'SBI Salary Account', type: 'Bank Account' },
    { id: 'pp5', name: 'Zerodha Coin - Parag Parikh 5% returns fund', type: 'Mutual Fund' },
    { id: 'pp10', name: 'Zerodha Coin - Parag Parikh 10% returns fund', type: 'Mutual Fund' },
    { id: 'pp15', name: 'Zerodha Coin - Parag Parikh 15% returns fund', type: 'Mutual Fund' }
];

const transactions = [];

// Helper to add transaction
function addTransaction(date, description, amount, accountId) {
    transactions.push({
        date: date.toISOString().split('T')[0],
        description,
        amount,
        accountId
    });
}

// Simulation Parameters
const startDate = new Date('2025-04-01'); // Start of FY 2025-26
const endDate = new Date('2027-03-31');   // End of FY 2026-27
const sipStartDate = new Date('2025-11-01');

// Opening Balance
addTransaction(startDate, 'Opening Balance', 7200000, 'sbi');

// Loop through dates
let currentDate = new Date(startDate);

// Track Fund Balances for Payout Calculation
let balance5 = 0;
let balance10 = 0;

while (currentDate <= endDate) {
    const day = currentDate.getDate();
    const month = currentDate.getMonth(); // 0-11
    const year = currentDate.getFullYear();

    // SIPs: 1st of every month starting Nov 2025
    if (day === 1 && currentDate >= sipStartDate) {
        // Debit SBI
        addTransaction(currentDate, 'SIP Installment', -300000, 'sbi');

        // Credit 5% Fund (2 Lac)
        addTransaction(currentDate, 'SIP Investment', 200000, 'pp5');
        balance5 += 200000;

        // Credit 10% Fund (1 Lac)
        addTransaction(currentDate, 'SIP Investment', 100000, 'pp10');
        balance10 += 100000;

        // Payout Logic for 5% Fund (Monthly)
        // Assumption: Payout happens on 1st of month based on previous month's balance? 
        // Or strictly: "add this transactions... which will give monthly payout". 
        // Let's assume payout generates immediately or next month? 
        // "starting from the end of the first month" per context from previous conversation summary, 
        // but let's stick to "monthly payout". I'll pay out on the 1st of the month *after* investment?
        // Let's keep it simple: Payout on 1st of month for the *previous* month's holding?
        // Actually, if I invest on 1st, maybe payout is next month 1st.
        // Let's check if we are *after* the first investment.
        // If balance > 0, generate payout.
        // BUT, we just added to balance. So payout should probably be on the *previous* balance before this SIP?
        // Or is it calculated on the new balance? "5% return". 
        // I will calculate payout on the balance *before* today's SIP to start, or maybe end of month?
        // Let's do payout on the 1st of the month, based on the *current* balance (post-SIP) for simplicity/optimism, 
        // OR better: Payout is generated *from* the fund.

        // Logic: 5% Annual Return paid monthly = (Balance * 0.05) / 12
        // We will generate the payout *same day* as SIP for simplicity of the ledger loop, 
        // or effectively "Monthly Payout".
        // Let's pay out on the *accumulated* balance.
        // Note: The prompt says "starting from the end of the first month" in the *summary* of previous conversation, 
        // but here says "gives monthly payout".
        // I will trigger payout on the 1st of every month provided there is a balance.

        if (balance5 > 0) {
            // wait, if I just added 200k, should I pay out on that 200k immediately? Unlikely.
            // I should probably pay out on the balance *before* the new 200k is added?
            // Let's be precise: "invested 2 lac... which will give monthly payout".
            // I'll calculate payout on the balance *including* this month if it's "advance" or *excluding* if "arrears".
            // Standard is arrears. So calculate on (balance5 - 200000).
            // But if this is the FIRST month (Nov 1), previous balance is 0. So no payout Nov 1.
            // Next month Dec 1: Balance is 200k. Payout on 200k. Then add new 200k. 
            // That feels correct.

            const payoutBase = balance5 - 200000;
            if (payoutBase > 0) {
                const monthlyPayout = Math.round((payoutBase * 0.05) / 12);
                if (monthlyPayout > 0) {
                    addTransaction(currentDate, 'Monthly Payout (5% Fund)', -monthlyPayout, 'pp5');
                    addTransaction(currentDate, 'Reinvestment from 5% Fund', monthlyPayout, 'pp15');
                    // Note: Payout leaves the 5% fund (Debit) and enters 15% fund (Credit).
                    // Does it reduce the capital in 5% fund? "gives monthly payout" usually implies dividend/interest 
                    // without reducing principal, OR unit redemption. 
                    // Usually "Arbitrage fund" with "payout" option keeps NAV steady (mostly) and pays out dividend.
                    // So Principal `balance5` should theoretically stay same? 
                    // "which will give monthly payout" -> implied Dividend Payout option.
                    // So I will NOT reduce `balance5` variable (which tracks principal for future calc).
                    // But I DO record a negative transaction to show money leaving? 
                    // No, "Payout" is income. 
                    // If it's a Dividend Payout: 
                    // Fund Value (Principal) stays 2L. 
                    // Cash comes out.
                    // Implementation: 
                    // Transaction in 'pp5': Description "Dividend Payout", Amount 0? Or Amount -Payout?
                    // If I put -Payout, the running balance of 'pp5' in the table will decrease. 
                    // But the *actual* value of the investment (Principal) is constant.
                    // The USER wants to see "transactions". 
                    // If I show -Payout in PP5, it looks like withdrawal. 
                    // If PP5 is a "Ledger of Value", then Payout shouldn't reduce it if it's "Return".
                    // But if it's "Transfer", money moves.
                    // Let's treat PP5 Ledger as "Cash Flow" or "Value"? 
                    // Usually these accounts track "Holdings".
                    // If Dividend is paid, it doesn't reduce unit balance (mostly). 
                    // I will NOT show a negative entry in PP5 for the payout itself effectively reducing principal.
                    // I will show:
                    // 1. PP5 generates payout. (Maybe just show the Credit in PP15?)
                    // The user said: "all the 13 payouts... invested into... 15% fund".
                    // So I definitely need Credit in PP15.
                    // Should I show Debit in PP5?
                    // If I don't, PP5 balance keeps increasing by 2L SIP.
                    // If I do, PP5 balance reduces? No, dividend doesn't reduce capital.
                    // So I will only show the INFLOW to PP15.
                    // And maybe a "Reference" in the description.
                }
            }
        }
    }

    // Payout Logic for 10% Fund (Oct 30th)
    if (month === 9 && day === 30) { // Oct is 9
        // Calculate 10% annual return?
        // "gives payout once in Oct 30th every year"
        // Base? All accumulated capital? 
        // Yes, `balance10`.
        if (balance10 > 0) {
            const annualPayout = Math.round(balance10 * 0.10);
            addTransaction(currentDate, 'Annual Payout (10% Fund)', -annualPayout, 'pp10');
            // Wait, same logic. Does it reduce principal? 
            // "Conservative Hybrid Fund" - usually growth or IDCW. 
            // If IDCW (Payout), NAV drops by payout amount. 
            // So Principal (Market Value) DROPS.
            // Unlike "Interest", Mutual Fund Dividends differ. 
            // But "Arbitrage Fund 5% return" sounds like a fixed deposit substitute mental model.
            // User likely expects Principal to stay intact? 
            // "Manjesh invested 2 lac... which will give...".
            // I will assume Principal stays intact for the sake of the "Bank/FD" mental model unless specified.
            // So I will NOT debit the source fund. 
            // Only Credit the destination fund.

            // UPDATE: User asked for "transactions... opening balance... closing balance".
            // If I don't debit, where does the money come from? 
            // Magic?
            // In accounting: 
            // Income Account -> Payout.
            // But here we only have Asset Accounts (Bank, MF).
            // So it appears as "Gain" (Credit to PP15) without Debit elsewhere.
            // That's acceptable for an Investment Dashboard (Returns are new money).
            // However, checking "transactions.json" request: 
            // "Opening Balance... SIP... Payout... invested into..."
            // I will log the "Investment" in PP15.
            // I will NOT log a Debit in PP5/10.

            addTransaction(currentDate, 'Reinvestment from 10% Fund', annualPayout, 'pp15');
        }
    }

    // Increment Day
    currentDate.setDate(currentDate.getDate() + 1);
}

// Export to global scope
window.dashboardData = { accounts, transactions };
