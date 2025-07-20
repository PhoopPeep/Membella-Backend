const { AppError, ValidationError, asyncHandler } = require('../src/utils/errorHandler');

describe('errorHandler utils', () => {
  // Test AppError creation and properties
  it('should create an AppError with correct status', () => {
    const err = new AppError('fail', 400);
    expect(err.message).toBe('fail');
    expect(err.statusCode).toBe(400);
    expect(err.status).toBe('fail');
  });

  // Test ValidationError creation and errors array
  it('should create a ValidationError with errors array', () => {
    const err = new ValidationError('validation', ['e1']);
    expect(err.message).toBe('validation');
    expect(err.errors).toContain('e1');
  });

  // Test asyncHandler utility calls next on error
  it('should call next on asyncHandler error', async () => {
    const fn = asyncHandler(async () => { throw new Error('fail'); });
    const next = jest.fn();
    await fn({}, {}, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
}); 