# Firestore Security Specification

This security specification implements attribute-based access control (ABAC) and follows a zero-trust model to protect user data, products, orders, and plans.

## 1. Data Invariants
- **Products**: Read-only for public clients; write operations (create, update, delete) are strictly confined to authorized Administrators.
- **Users**: Users can only read and write their own profile information (`uid == request.auth.uid`). No identity spoofing or role self-escalation is permitted.
- **Plans**: An irrigation plan must belong to the authenticated owner. A user cannot read, update, or delete another user's plans (`userId == request.auth.uid`).
- **Orders**: Users can create orders. Standard users can only list and read their own orders. Admin gets complete read/write access.
- **Carts**: Authenticated users can store and retrieve their own cart state. Others cannot read or alter another user's cart.

---

## 2. The "Dirty Dozen" Payloads (Attack Vectors Rejected by Security Rules)

### Attack Vector 1: Anonymous Write to Products Catalog
```json
{
  "path": "/products/fake-id-123",
  "auth": null,
  "action": "create",
  "data": { "id": "fake-id-123", "name": "Hack Product", "price": 0.01, "category": "Planer Artikel" }
}
```
*Expected Result: `PERMISSION_DENIED`*

### Attack Vector 2: User Accessing Other User Profile
```json
{
  "path": "/users/user_bob_id",
  "auth": { "uid": "user_alice_id" },
  "action": "get"
}
```
*Expected Result: `PERMISSION_DENIED`*

### Attack Vector 3: Privilege Self-Escalation (Setting `isAdmin` on User Profile)
```json
{
  "path": "/users/user_alice_id",
  "auth": { "uid": "user_alice_id" },
  "action": "create",
  "data": { "id": "user_alice_id", "username": "alice", "email": "alice@company.com", "isAdmin": true }
}
```
*Expected Result: `PERMISSION_DENIED` (isAdmin must only be set via static administrative mapping or forbidden fields)*

### Attack Vector 4: Tampering with Product Prices in Shop Catalog
```json
{
  "path": "/products/planner-pipe-25",
  "auth": { "uid": "standard_user_id" },
  "action": "update",
  "data": { "price": 0.01 }
}
```
*Expected Result: `PERMISSION_DENIED`*

### Attack Vector 5: Saving Plan Under Someone Else's User ID
```json
{
  "path": "/plans/plan-999",
  "auth": { "uid": "hacker_uid" },
  "action": "create",
  "data": { "id": "plan-999", "userId": "victim_uid", "name": "Hijacked Garden" }
}
```
*Expected Result: `PERMISSION_DENIED`*

### Attack Vector 6: Updating Sibling Saved Plan Fields Not Owned By Current User
```json
{
  "path": "/plans/victim_plan_id",
  "auth": { "uid": "hacker_uid" },
  "action": "update",
  "data": { "name": "Malicious Alteration" }
}
```
*Expected Result: `PERMISSION_DENIED`*

### Attack Vector 7: Injecting Malicious Excess Data to Cause ID/Field Exhaustion
```json
{
  "path": "/plans/plan_super_long_junk_characters_which_are_unreasonable_and_very_large_to_exploit_the_database_quota_system",
  "auth": { "uid": "standard_user_id" },
  "action": "create",
  "data": { "id": "plan_long_string", "userId": "standard_user_id", "name": "Poison ID Plan" }
}
```
*Expected Result: `PERMISSION_DENIED` (due to ID format verification)*

### Attack Vector 8: Reading All Shop Orders Blankly Without Restrictions
```json
{
  "path": "/orders",
  "auth": { "uid": "standard_user" },
  "action": "list"
}
```
*Expected Result: `PERMISSION_DENIED` (Standard users cannot list all orders, must query with proper filtering: `resource.data.userId == request.auth.uid`)*

### Attack Vector 9: Tampering with Sibling Shopping Cart
```json
{
  "path": "/carts/victim_user_id",
  "auth": { "uid": "hacker_uid" },
  "action": "update",
  "data": { "items": [] }
}
```
*Expected Result: `PERMISSION_DENIED`*

### Attack Vector 10: Anonymous Attempt to Register Order Details
```json
{
  "path": "/orders/order_762",
  "auth": null,
  "action": "create",
  "data": { "id": "order_762", "customerName": "John Anonymous", "total": 125, "status": "Ausstehend", "items": [] }
}
```
*Expected Result: `PERMISSION_DENIED`*

### Attack Vector 11: Hijacking a Saved Plan's Immortal `userId` Field During Update
```json
{
  "path": "/plans/my_plan_id",
  "auth": { "uid": "my_user_id" },
  "action": "update",
  "data": { "userId": "hacker_id", "name": "Swapped Owner Plan" }
}
```
*Expected Result: `PERMISSION_DENIED` (userId is immortal/immutable)*

### Attack Vector 12: Injecting Malicious Fields Not Present in Standard Product Entity Schema
```json
{
  "path": "/products/new-prod",
  "auth": { "uid": "standard_user_id" },
  "action": "create",
  "data": { "id": "new-prod", "name": "Spoofed", "price": 10, "unsupportedGhostField": "malicious" }
}
```
*Expected Result: `PERMISSION_DENIED`*
