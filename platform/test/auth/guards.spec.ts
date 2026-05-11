import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../src/auth/guards/roles.guard';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator';

function makeContext(user: any, handlerRoles: string[] | undefined): any {
  const reflector = new Reflector();
  // Mock getAllAndOverride to return handlerRoles
  jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
    if (key === ROLES_KEY) return handlerRoles;
    return undefined;
  });

  const guard = new RolesGuard(reflector);

  const context: any = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  };

  return { guard, context };
}

describe('RolesGuard', () => {
  it('allows access when no roles are required', () => {
    const { guard, context } = makeContext({ role: 'student' }, undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when user role matches required role', () => {
    const { guard, context } = makeContext({ role: 'instructor' }, ['instructor']);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException when user role does not match', () => {
    const { guard, context } = makeContext({ role: 'student' }, ['instructor']);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when there is no user on the request', () => {
    const { guard, context } = makeContext(undefined, ['admin']);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
