import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PublicUser } from '../../users/public-user.type';

type RequestWithUser = {
  user?: PublicUser;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PublicUser | undefined => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
