import { supabase } from "../../config/supabase"

type GetUsersParams = {
  search?: string
  role?: string
  status?: string
  from?: string
  to?: string
  sort?: "asc" | "desc"
}

/* --------------------------------
   GET USERS
-------------------------------- */

export const getUsersService = async ({
  search,
  role,
  status,
  from,
  to,
  sort = "desc"
}: GetUsersParams) => {

  let query = supabase
    .from("users_view")
    .select("*")
    .order("created_at", { ascending: sort === "asc" })

  if (search) query = query.ilike("name", `%${search}%`)
  if (role) query = query.eq("role", role)
  if (status) query = query.eq("status", status)
  if (from) query = query.gte("created_at", from)
  if (to) query = query.lte("created_at", to)

  const { data, error } = await query

  if (error) throw new Error(error.message)

  return data ?? []
}

/* --------------------------------
   GET USER BY ID
-------------------------------- */

export const getUserByIdService = async (id: string) => {

  const { data, error } = await supabase
    .from("users_view")
    .select("*")
    .eq("id", id)
    .single()

  if (error) throw new Error(error.message)

  return data
}

/* --------------------------------
   UPDATE USER
-------------------------------- */

export const updateUserService = async (
  id: string,
  first_name?: string,
  middle_name?: string,
  last_name?: string,
  role?: string
) => {

  const updateData: any = {}

  if (first_name) updateData.first_name = first_name
  if (middle_name !== undefined) updateData.middle_name = middle_name
  if (last_name) updateData.last_name = last_name
  if (role) updateData.role = role

  // ✅ keep name synced
  if (first_name || middle_name || last_name) {
    updateData.name = `${first_name ?? ""} ${middle_name ?? ""} ${last_name ?? ""}`.trim()
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data
}

/* --------------------------------
   DELETE USER
-------------------------------- */

export const deleteUserService = async (id: string) => {

  const { data, error } = await supabase
    .from("profiles")
    .update({ status: "deleted" })
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data
}

/* --------------------------------
   SUSPEND USER
-------------------------------- */

export const suspendUserService = async (
  id: string,
  days: number,
  reason: string
) => {

  const suspendedUntil = new Date()
  suspendedUntil.setDate(suspendedUntil.getDate() + days)

  const { data, error } = await supabase
    .from("profiles")
    .update({
      status: "suspended",
      suspended_until: suspendedUntil.toISOString(),
      suspension_reason: reason
    })
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data
}

/* --------------------------------
   UNSUSPEND USER
-------------------------------- */

export const unsuspendUserService = async (id: string) => {

  const { data, error } = await supabase
    .from("profiles")
    .update({
      status: "active",
      suspended_until: null,
      suspension_reason: null
    })
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data
}

/* --------------------------------
   CREATE USER (FINAL FIX)
-------------------------------- */

export const createUserService = async ({
  email,
  password,
  first_name,
  middle_name,
  last_name,
  role,
  contact_number,
  license_number
}: {
  email: string
  password: string
  first_name: string
  middle_name?: string
  last_name: string
  role: string
  contact_number?: string
  license_number?: string
}) => {

  const allowedRoles = ["admin", "operator", "driver", "passenger"]

  if (!allowedRoles.includes(role)) {
    throw new Error("Invalid role")
  }

  /* -------------------------------
     1. CREATE AUTH USER
  -------------------------------- */

  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false
    })

  if (authError) {
    throw new Error("Auth error: " + authError.message)
  }

  if (!authData?.user) {
    throw new Error("User creation failed")
  }

  const userId = authData.user.id

  /* -------------------------------
     2. CREATE FULL NAME (REQUIRED)
  -------------------------------- */

  const fullName = `${first_name} ${middle_name ?? ""} ${last_name}`.trim()

  /* -------------------------------
     3. INSERT PROFILE
  -------------------------------- */

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      name: fullName, // ✅ REQUIRED FIX
      first_name,
      middle_name,
      last_name,
      email,
      contact_number,
      role,
      status: "active"
    })
    .select()
    .single()

  if (profileError) {

    // 🔥 IMPORTANT: rollback auth user if profile fails
    await supabase.auth.admin.deleteUser(userId)

    throw new Error("Profile error: " + profileError.message)
  }

  /* -------------------------------
     4. DRIVER EXTRA TABLE
  -------------------------------- */

  if (role === "driver") {

    if (!license_number) {
      throw new Error("License number is required for driver")
    }

    const { error: driverError } = await supabase
      .from("drivers")
      .insert({
        user_id: userId,
        first_name,
        middle_name,
        last_name,
        email,
        contact_number,
        license_number
      })

    if (driverError) {
      throw new Error("Driver error: " + driverError.message)
    }
  }

  return profile
}