import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PmOrchestratorGuard } from './pm-orchestrator.guard';

function mockContext(headers: Record<string, string | undefined>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as ExecutionContext;
}

describe('PmOrchestratorGuard', () => {
  const prev = process.env.PM_ORCHESTRATOR_SECRET;
  const guard = new PmOrchestratorGuard();

  afterEach(() => {
    process.env.PM_ORCHESTRATOR_SECRET = prev;
  });

  it('throws when PM_ORCHESTRATOR_SECRET is unset', () => {
    delete process.env.PM_ORCHESTRATOR_SECRET;
    expect(() =>
      guard.canActivate(mockContext({ authorization: 'Bearer x' })),
    ).toThrow(UnauthorizedException);
  });

  it('throws when Authorization header missing', () => {
    process.env.PM_ORCHESTRATOR_SECRET = 'secret';
    expect(() => guard.canActivate(mockContext({}))).toThrow(UnauthorizedException);
  });

  it('throws when Bearer token wrong', () => {
    process.env.PM_ORCHESTRATOR_SECRET = 'correct';
    expect(() =>
      guard.canActivate(mockContext({ authorization: 'Bearer wrong' })),
    ).toThrow(UnauthorizedException);
  });

  it('returns true when Bearer matches secret', () => {
    process.env.PM_ORCHESTRATOR_SECRET = 'my-token';
    expect(
      guard.canActivate(mockContext({ authorization: 'Bearer my-token' })),
    ).toBe(true);
  });
});
