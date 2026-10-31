import type { Access } from 'payload'
export const isAdmin: Access = ({ req }) =>
  req.user?.collection === 'admin-users'
export const never: Access = () => false
export const privateAccess = {
  create: isAdmin,
  read: isAdmin,
  update: isAdmin,
  delete: isAdmin,
}
export const immutableAccess = {
  create: never,
  read: isAdmin,
  update: never,
  delete: never,
}
