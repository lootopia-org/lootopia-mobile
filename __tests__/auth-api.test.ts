import {
  authApi,
  LoginResponse,
  User,
  TotpEnrollBeginResponse,
  WebauthnBeginResponse,
  WebauthnCompleteResponse,
  WebauthnCredential,
} from '../src/lib/auth-api';

// Mock fetch
(globalThis as any).fetch = jest.fn();
const mockedFetch = jest.mocked(globalThis.fetch as any);

describe('authApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockSuccessResponse = (data: any) => {
    return () => Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(data),
      redirected: false,
      type: 'basic',
      url: '',
    } as unknown as Response);
  };

  const mockErrorResponse = (status: number, data: any = {}) => {
    return () => Promise.resolve({
      ok: false,
      status,
      statusText: 'Error',
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(data),
      redirected: false,
      type: 'basic',
      url: '',
    } as unknown as Response);
  };

  describe('register', () => {
    it('should call register endpoint', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      
      mockedFetch.mockImplementation(mockSuccessResponse({}));
      
      await authApi.register(email, password);
      
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/register'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
      );
    });
  });

  describe('verifyEmail', () => {
    it('should call verify email endpoint', async () => {
      const token = 'test-token-123';
      
      mockedFetch.mockImplementation(mockSuccessResponse({}));
      
      await authApi.verifyEmail(token);
      
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/auth/verify-email?token=${encodeURIComponent(token)}`),
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  describe('login', () => {
    it('should call login endpoint and return response', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const mockResponse: LoginResponse = {
        token: 'test-token',
        mfaRequired: false,
        mfaMethods: [],
      };
      
      mockedFetch.mockImplementation(mockSuccessResponse(mockResponse));
      
      const result = await authApi.login(email, password);
      
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('verifyTotp', () => {
    it('should call verify totp endpoint', async () => {
      const token = 'test-token';
      const code = '123456';
      const mockResponse: LoginResponse = {
        token: 'elevated-token',
        mfaRequired: false,
        mfaMethods: [],
      };
      
      mockedFetch.mockImplementation(mockSuccessResponse(mockResponse));
      
      const result = await authApi.verifyTotp(token, code);
      
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/mfa/totp'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ token, code }),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('WebAuthn login', () => {
    it('should call begin webauthn login', async () => {
      const email = 'test@example.com';
      const mockResponse: WebauthnBeginResponse = {
        handle: 'test-handle',
        publicKey: {},
      };
      
      mockedFetch.mockImplementation(mockSuccessResponse(mockResponse));
      
      const result = await authApi.beginWebauthnLogin(email);
      
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/webauthn/login/begin'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call complete webauthn login', async () => {
      const handle = 'test-handle';
      const credential = {};
      const mockResponse: WebauthnCompleteResponse = { token: 'webauthn-token' };
      
      mockedFetch.mockImplementation(mockSuccessResponse(mockResponse));
      
      const result = await authApi.completeWebauthnLogin(handle, credential);
      
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/webauthn/login/complete'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ handle, credential }),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('resendVerification', () => {
    it('should call resend verification endpoint', async () => {
      const email = 'test@example.com';
      
      mockedFetch.mockImplementation(mockSuccessResponse({}));
      
      await authApi.resendVerification(email);
      
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/resend-verification'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email }),
        })
      );
    });
  });

  describe('logout', () => {
    it('should call logout endpoint', async () => {
      const token = 'auth-token';
      
      mockedFetch.mockImplementation(mockSuccessResponse({}));
      
      await authApi.logout(token);
      
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
        })
      );
    });
  });

  describe('me', () => {
    it('should call me endpoint and return user', async () => {
      const token = 'auth-token';
      const mockUser: User = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
      };
      
      mockedFetch.mockImplementation(mockSuccessResponse(mockUser));
      
      const result = await authApi.me(token);
      
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/me'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
        })
      );
      expect(result).toEqual(mockUser);
    });
  });

  describe('TOTP enrollment', () => {
    it('should call begin totp enroll', async () => {
      const token = 'auth-token';
      const mockResponse: TotpEnrollBeginResponse = {
        secret: 'JBSWY3DPEHPK3PXP',
        otpauthUri: 'otpauth://totp/Test:test?secret=JBSWY3DPEHPK3PXP',
      };
      
      mockedFetch.mockImplementation(mockSuccessResponse(mockResponse));
      
      const result = await authApi.beginTotpEnroll(token);
      
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/totp/enroll/begin'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call verify totp enroll', async () => {
      const token = 'auth-token';
      const code = '123456';
      
      mockedFetch.mockImplementation(mockSuccessResponse({}));
      
      await authApi.verifyTotpEnroll(token, code);
      
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/totp/enroll/verify'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
          body: JSON.stringify({ code }),
        })
      );
    });

    it('should call disable totp', async () => {
      const token = 'auth-token';
      const code = '123456';
      
      mockedFetch.mockImplementation(mockSuccessResponse({}));
      
      await authApi.disableTotp(token, code);
      
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/totp/disable'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
          body: JSON.stringify({ code }),
        })
      );
    });
  });

  describe('WebAuthn registration', () => {
    it('should call begin webauthn register', async () => {
      const token = 'auth-token';
      const mockResponse: WebauthnBeginResponse = {
        handle: 'register-handle',
        publicKey: {},
      };
      
      mockedFetch.mockImplementation(mockSuccessResponse(mockResponse));
      
      const result = await authApi.beginWebauthnRegister(token);
      
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/webauthn/register/begin'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call complete webauthn register', async () => {
      const token = 'auth-token';
      const handle = 'register-handle';
      const credential = {};
      
      mockedFetch.mockImplementation(mockSuccessResponse({}));
      
      await authApi.completeWebauthnRegister(token, handle, credential);
      
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/webauthn/register/complete'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
          body: JSON.stringify({ handle, credential }),
        })
      );
    });

    it('should call list webauthn credentials', async () => {
      const token = 'auth-token';
      const mockCredentials: WebauthnCredential[] = [
        { id: '1', createdAt: '2024-01-01T00:00:00Z' },
      ];
      
      mockedFetch.mockImplementation(mockSuccessResponse(mockCredentials));
      
      const result = await authApi.listWebauthnCredentials(token);
      
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/webauthn/credentials'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
        })
      );
      expect(result).toEqual(mockCredentials);
    });
  });

  describe('error handling', () => {
    it('should throw error when request fails', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const errorData = { message: 'Invalid credentials', code: 'UNAUTHORIZED' };
      
      mockedFetch.mockImplementation(mockErrorResponse(401, errorData));
      
      await expect(authApi.login(email, password)).rejects.toThrow('Invalid credentials');
    });
  });
});
