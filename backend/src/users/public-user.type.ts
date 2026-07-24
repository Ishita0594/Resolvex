import { UserRole } from './user-role.enum';

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type StoredUser = PublicUser & {
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};
