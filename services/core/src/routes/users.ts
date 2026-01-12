import { Hono } from 'hono';
import { users, CreateUserSchema, UpdateUserSchema } from '@credopass/lib/schemas';
import { createCrudRoute } from '../util/crud-factory';

const usersRouter = new Hono();

usersRouter.route('/', createCrudRoute({
  table: users,
  createSchema: CreateUserSchema,
  updateSchema: UpdateUserSchema,
  sortField: users.createdAt,
  uniqueFields: ['email']
}));

export default usersRouter;
