import ApiError from '../errors/apiError.js';

/**
 * Express middleware generator to validate request payloads using DTO schemas
 * 
 * @param {BaseDTO} DTOClass - The DTO class executing .validate
 * @param {object} schema - Schema rules validation object
 * @param {string} source - 'body' | 'query' | 'params'
 */
export const validateRequest = (DTOClass, schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const dataToValidate = req[source];
      const validatedData = DTOClass.validate(dataToValidate, schema);
      
      // Overwrite request property with clean validated data
      req[source] = validatedData;
      next();
    } catch (err) {
      next(err);
    }
  };
};
export default validateRequest;
