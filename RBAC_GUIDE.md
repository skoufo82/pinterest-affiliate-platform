# Role-Based Access Control (RBAC) Guide

## Overview
The platform now supports two user roles with different permission levels.

## Roles

### 1. Admin (Full Access)
**Permissions:**
- ✅ Manage users (create, delete, reset passwords)
- ✅ Manage products (create, edit, delete)
- ✅ Access all admin features
- ✅ View user management dashboard

**Visual Indicators:**
- Purple "Admin" badge in sidebar
- "Users" menu item visible
- Full navigation menu

### 2. Editor (Limited Access)
**Permissions:**
- ✅ Manage products (create, edit, delete)
- ❌ Cannot manage users
- ❌ Cannot access user management

**Visual Indicators:**
- Blue "Editor" badge in sidebar
- No "Users" menu item
- Limited navigation menu

## Creating Users with Roles

### Via Admin Portal

1. Log in as an Admin
2. Navigate to **Users** menu
3. Click **Create New User**
4. Fill in user details
5. **Select Role:**
   - **Editor** - For product managers (default)
   - **Admin** - For full administrators
6. Choose email invitation option
7. Click **Create User**

### Default Behavior
- New users default to **Editor** role
- Only Admins can create other Admins
- Role is assigned during user creation

## Cognito Groups

The system uses AWS Cognito groups for role management:

- **Admins** group - Full access users
- **Editors** group - Limited access users

## Checking User Roles

### In the UI
- Check the badge in the sidebar (purple = Admin, blue = Editor)
- Admins see "Users" menu item
- Editors don't see "Users" menu item

### Programmatically
```typescript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { isAdmin, userGroups } = useAuth();
  
  if (isAdmin) {
    // Show admin-only features
  }
  
  // Check specific groups
  if (userGroups.includes('Admins')) {
    // Admin logic
  }
}
```

## Security

### Backend Enforcement
- Role is stored in Cognito groups
- JWT tokens include group membership
- Backend validates group membership for protected operations

### Frontend Protection
- Menu items hidden based on role
- Routes can be protected with role checks
- UI elements conditionally rendered

## Upgrading User Roles

To change a user's role:

1. **Via AWS Console:**
   - Go to Cognito User Pool
   - Find the user
   - Add/remove from groups

2. **Via AWS CLI:**
```bash
# Add user to Admins group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_dgrSfYa3L \
  --username USERNAME \
  --group-name Admins \
  --profile default

# Remove user from Editors group
aws cognito-idp admin-remove-user-from-group \
  --user-pool-id us-east-1_dgrSfYa3L \
  --username USERNAME \
  --group-name Editors \
  --profile default
```

## Best Practices

1. **Principle of Least Privilege**
   - Default to Editor role
   - Only grant Admin when necessary
   - Regularly audit Admin users

2. **Admin Account Security**
   - Use strong passwords for Admin accounts
   - Enable MFA (future enhancement)
   - Limit number of Admin users

3. **Role Assignment**
   - Product managers → Editor
   - System administrators → Admin
   - Your account → Admin

## Future Enhancements

Potential role system improvements:

- **Custom Roles** - Define custom permission sets
- **Granular Permissions** - Per-feature permissions
- **Role Hierarchy** - Super Admin, Admin, Editor, Viewer
- **Audit Logging** - Track role changes and admin actions
- **MFA Requirement** - Require MFA for Admin accounts

## Troubleshooting

### User can't see expected features
- Check their role badge in sidebar
- Verify group membership in Cognito
- User may need to log out and back in

### Role not updating after change
- User must log out and log back in
- JWT token contains cached group info
- Token refresh happens on new login

### Can't create Admin users
- Only Admins can create other Admins
- Check your own role first
- Verify you're in Admins group

## Technical Details

### Token Structure
JWT ID token includes:
```json
{
  "cognito:groups": ["Admins"],
  "cognito:username": "username",
  "email": "user@example.com"
}
```

### Group Extraction
```typescript
const idToken = session.getIdToken();
const payload = idToken.decodePayload();
const groups = payload['cognito:groups'] || [];
const isAdmin = groups.includes('Admins');
```

### Backend Validation
```typescript
const { role = 'Editor' } = JSON.parse(event.body);
const groupName = role === 'Admin' ? 'Admins' : 'Editors';
// Assign user to group
```
