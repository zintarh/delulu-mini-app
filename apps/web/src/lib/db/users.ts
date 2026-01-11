import { db } from "./index";
import type { CreateUserInput } from "@/lib/validations/user";

export async function findOrCreateUser(input: CreateUserInput) {
  const { address, ...rest } = input;

  return db.user.upsert({
    where: { address: address.toLowerCase() },
    update: { ...rest },
    create: { address: address.toLowerCase(), ...rest },
  });
}

export async function getUserByAddress(address: string) {
  return db.user.findUnique({
    where: { address: address.toLowerCase() },
  });
}

export async function getUserByFid(fid: number) {
  return db.user.findUnique({
    where: { fid },
  });
}

export async function updateUser(
  address: string,
  data: Partial<Omit<CreateUserInput, "address">>
) {
  return db.user.update({
    where: { address: address.toLowerCase() },
    data,
  });
}
