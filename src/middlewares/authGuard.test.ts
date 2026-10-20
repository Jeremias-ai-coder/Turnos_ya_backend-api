import { authGuard } from './authGuard';
import { AppError } from './errorHandler';
import jwt from 'jsonwebtoken';

describe('authGuard Middleware (Unit Tests)', () => {
  const secret = 'super_secret';
  let mockReq: any;
  let mockRes: any;
  let nextFn: jest.Mock;

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    mockReq = {
      headers: {},
    };
    mockRes = {};
    nextFn = jest.fn();
  });

  it('debe lanzar AppError 401 si no se envía la cabecera Authorization', () => {
    expect(() => authGuard(mockReq, mockRes, nextFn)).toThrow(AppError);
    expect(() => authGuard(mockReq, mockRes, nextFn)).toThrow('No autorizado');
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('debe lanzar AppError 401 si la cabecera Authorization no tiene el prefijo Bearer', () => {
    mockReq.headers.authorization = 'Basic dXNlcjpwYXNz';

    expect(() => authGuard(mockReq, mockRes, nextFn)).toThrow(AppError);
    expect(() => authGuard(mockReq, mockRes, nextFn)).toThrow('No autorizado');
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('debe asignar el usuario decodificado a req.user y llamar a next() con un token válido', () => {
    const payload = { id: 10, email: 'test@turnosya.com', role: 'client' };
    const validToken = jwt.sign(payload, secret);
    mockReq.headers.authorization = `Bearer ${validToken}`;

    authGuard(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalledTimes(1);
    expect(mockReq.user).toMatchObject(payload);
  });

  it('debe lanzar AppError 401 si el token está firmado con otra clave secreta o está corrupto', () => {
    const fakeToken = jwt.sign({ id: 1 }, 'otra_clave_distinta');
    mockReq.headers.authorization = `Bearer ${fakeToken}`;

    expect(() => authGuard(mockReq, mockRes, nextFn)).toThrow(AppError);
    expect(() => authGuard(mockReq, mockRes, nextFn)).toThrow('Token inválido o expirado');
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('debe lanzar AppError 401 si el token ha expirado', () => {
    const expiredToken = jwt.sign({ id: 1 }, secret, { expiresIn: -10 });
    mockReq.headers.authorization = `Bearer ${expiredToken}`;

    expect(() => authGuard(mockReq, mockRes, nextFn)).toThrow(AppError);
    expect(() => authGuard(mockReq, mockRes, nextFn)).toThrow('Token inválido o expirado');
    expect(nextFn).not.toHaveBeenCalled();
  });
});
