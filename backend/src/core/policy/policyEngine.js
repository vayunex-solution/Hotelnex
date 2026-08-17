import logger from '../logger/logger.js';

class PolicyEngine {
  constructor() {
    this.rules = new Map(); // policyName -> evaluator function
  }

  /**
   * Register a business rule validation function
   * @param {string} policyName 
   * @param {Function} ruleFn - function(context, subject) -> { passed: boolean, message: string }
   */
  registerRule(policyName, ruleFn) {
    this.rules.set(policyName, ruleFn);
    logger.info(`[PolicyEngine] Registered business rule: ${policyName}`);
  }

  /**
   * Check if a policy is satisfied
   * 
   * @param {string} policyName 
   * @param {object} context - User context / role / tenant
   * @param {*} subject - Entity subject to validate (e.g. room, invoice)
   * @returns {object} { passed: boolean, message: string }
   */
  check(policyName, context, subject) {
    const evaluator = this.rules.get(policyName);
    if (!evaluator) {
      logger.warn(`[PolicyEngine] Policy check requested for unregistered rule: ${policyName}. Auto-passing.`);
      return { passed: true, message: 'Policy ignored: No handler registered' };
    }

    try {
      const result = evaluator(context, subject);
      logger.debug(`[PolicyEngine] Checked: ${policyName} | Result: ${result.passed ? 'PASS' : 'FAIL'}`);
      return result;
    } catch (err) {
      logger.error(`[PolicyEngine] Rule ${policyName} evaluation error:`, err.message);
      return { passed: false, message: `Evaluation error: ${err.message}` };
    }
  }
}

const policyEngine = new PolicyEngine();
export default policyEngine;
