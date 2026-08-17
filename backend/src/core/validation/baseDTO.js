import ApiError from '../errors/apiError.js';

class BaseDTO {
  /**
   * Validates a request object against a validator rules schema
   * 
   * @param {object} data - request body/params/query 
   * @param {object} schema - object containing schema check functions or Joi rules
   */
  static validate(data, schema) {
    if (!data || typeof data !== 'object') {
      throw ApiError.badRequest('Invalid request payload. Expected object.');
    }

    const errors = [];
    const validated = {};

    for (const [field, rules] of Object.entries(schema)) {
      const val = data[field];

      if (rules.required && (val === undefined || val === null || val === '')) {
        errors.push({ field, message: `${field} is a required field.` });
        continue;
      }

      if (val !== undefined && val !== null) {
        // Validate type rules
        if (rules.type === 'string' && typeof val !== 'string') {
          errors.push({ field, message: `${field} must be a string.` });
        } else if (rules.type === 'number' && isNaN(Number(val))) {
          errors.push({ field, message: `${field} must be a number.` });
        } else if (rules.type === 'boolean' && typeof val !== 'boolean') {
          errors.push({ field, message: `${field} must be a boolean.` });
        } else {
          validated[field] = val;
        }
      } else {
        // Assign default value
        if (rules.default !== undefined) {
          validated[field] = rules.default;
        }
      }
    }

    if (errors.length > 0) {
      throw ApiError.badRequest('Validation failed.', errors);
    }

    return validated;
  }
}

export default BaseDTO;
