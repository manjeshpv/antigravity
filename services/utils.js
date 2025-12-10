// Utility Functions

/**
 * Formats a number as INR Currency
 * @param {number} amount 
 * @returns {string} e.g. "₹1,50,000.00"
 */
function formatCurrency(amount) {
    return amount.toLocaleString('en-IN', {
        style: 'currency',
        currency: 'INR'
    });
}

/**
 * Formats a number as Percentage
 * @param {number} value (e.g. 0.15 for 15%)
 * @returns {string} e.g. "15.00%"
 */
function formatPct(value) {
    return (value * 100).toFixed(2) + '%';
}

/**
 * Calculates XIRR using Newton-Raphson method
 * @param {Array<{date: Date|string, amount: number}>} cashFlows 
 * @param {number} guess 
 * @returns {number} rate (e.g. 0.10 for 10%)
 */
function calculateXIRR(cashFlows, guess = 0.1) {
    if (cashFlows.length === 0) return 0;

    const limit = 100;
    const tol = 1e-6;
    let xirr = guess;

    // Sort flows by date
    const sortedFlows = [...cashFlows].sort((a, b) => new Date(a.date) - new Date(b.date));
    const startDate = new Date(sortedFlows[0].date);

    for (let i = 0; i < limit; i++) {
        let fValue = 0;
        let fDerivative = 0;

        for (const { date, amount } of sortedFlows) {
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

module.exports = {
    formatCurrency,
    formatPct,
    calculateXIRR
};
