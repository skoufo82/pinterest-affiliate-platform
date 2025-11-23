# Cognito Authentication Implementation Plan

## Overview

Add AWS Cognito authentication to secure the admin dashboard with the ability for administrators to manage users directly from the application.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Login Page   │  │ Admin Pages  │  │ User Mgmt    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   AWS Cognito User Pool                      │
│  - Email/Username login                                      │
│  - Password policies                                         │
│  - Admin group                                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway + Lambda                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Auth         │  │ Protected    │  │ User Mgmt    │     │
│  │ Endpoints    │  │ Admin APIs   │  │ APIs         │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Phase 1: Infrastructure (CDK)

**1.1 Add Cognito User Pool** ✅ (Already added)
- User pool with email/username login
- Password policy (8+ chars, upper, lower, digits)
- Email verification
- Admin group

**1.2 Add User Management Lambda Functions**
- `createUser` - Create new admin users
- `listUsers` - List all users
- `deleteUser` - Remove users
- `updateUser` - Update user details
- `setUserPassword` - Set/reset passwords

**1.3 Add Cognito Authorizer to API Gateway**
- Protect all `/admin/*` endpoints
- Require valid JWT token
- Check for Admin group membership

**1.4 Update Existing Lambda Functions**
- Add Cognito permissions to Lambda role
- Pass user context to functions

### Phase 2: Backend Lambda Functions

**2.1 Authentication Functions**
```
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
POST /api/auth/change-password
```

**2.2 User Management Functions** (Admin only)
```
GET  /api/admin/users
POST /api/admin/users
GET  /api/admin/users/:username
PUT  /api/admin/users/:username
DELETE /api/admin/users/:username
POST /api/admin/users/:username/reset-password
```

**2.3 Update Admin Endpoints**
- Add JWT validation
- Extract user info from token
- Log user actions

### Phase 3: Frontend Implementation

**3.1 Authentication Context**
- Create AuthContext for managing auth state
- Store JWT tokens securely
- Handle token refresh
- Provide login/logout functions

**3.2 Login Page**
- Email/username and password fields
- Form validation
- Error handling
- Remember me option
- Forgot password link

**3.3 Protected Routes**
- Wrap admin routes with auth check
- Redirect to login if not authenticated
- Show loading state during auth check

**3.4 User Management UI** (Admin Dashboard)
- List all users with roles
- Add new user form
- Edit user details
- Delete user with confirmation
- Reset user password
- Assign to Admin group

**3.5 User Profile**
- View current user info
- Change password
- Update profile details

### Phase 4: Security Enhancements

**4.1 Token Management**
- Store tokens in httpOnly cookies (if possible)
- Or use secure localStorage with encryption
- Implement token refresh before expiry
- Clear tokens on logout

**4.2 API Security**
- Validate JWT on every admin request
- Check group membership
- Rate limiting on auth endpoints
- CORS configuration

**4.3 Password Security**
- Enforce strong passwords
- Password reset via email
- Temporary passwords expire
- Account lockout after failed attempts

## Detailed Implementation

### Infrastructure Changes

**storage-stack.ts** - Add Cognito:
```typescript
// Cognito User Pool
const userPool = new cognito.UserPool(this, 'AdminUserPool', {
  userPoolName: 'PinterestAffiliateAdmins',
  selfSignUpEnabled: false,
  signInAliases: { email: true, username: true },
  autoVerify: { email: true },
  passwordPolicy: {
    minLength: 8,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
  },
});

// User Pool Client
const userPoolClient = new cognito.UserPoolClient(this, 'WebClient', {
  userPool,
  authFlows: {
    userPassword: true,
    userSrp: true,
  },
});

// Admin Group
new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
  userPoolId: userPool.userPoolId,
  groupName: 'Admins',
});
```

**backend-stack.ts** - Add Cognito Authorizer:
```typescript
// Cognito Authorizer
const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
  cognitoUserPools: [userPool],
});

// Protect admin endpoints
const adminResource = api.root.addResource('admin');
adminResource.addMethod('ANY', integration, {
  authorizer,
  authorizationType: apigateway.AuthorizationType.COGNITO,
});
```

### Lambda Functions

**createUser Function:**
```typescript
import { CognitoIdentityProviderClient, AdminCreateUserCommand } from '@aws-sdk/client-cognito-identity-provider';

export const handler = async (event) => {
  const { email, username, givenName, familyName, temporaryPassword } = JSON.parse(event.body);
  
  const client = new CognitoIdentityProviderClient({ region: process.env.REGION });
  
  const command = new AdminCreateUserCommand({
    UserPoolId: process.env.USER_POOL_ID,
    Username: username,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'given_name', Value: givenName },
      { Name: 'family_name', Value: familyName },
    ],
    TemporaryPassword: temporaryPassword,
    MessageAction: 'SUPPRESS', // Don't send email, we'll handle it
  });
  
  await client.send(command);
  
  // Add to Admin group
  await client.send(new AdminAddUserToGroupCommand({
    UserPoolId: process.env.USER_POOL_ID,
    Username: username,
    GroupName: 'Admins',
  }));
  
  return {
    statusCode: 201,
    body: JSON.stringify({ message: 'User created successfully' }),
  };
};
```

### Frontend Components

**AuthContext.tsx:**
```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { CognitoUser, AuthenticationDetails, CognitoUserPool } from 'amazon-cognito-identity-js';

interface AuthContextType {
  user: CognitoUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  getToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CognitoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const userPool = new CognitoUserPool({
    UserPoolId: import.meta.env.VITE_USER_POOL_ID,
    ClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
  });

  useEffect(() => {
    // Check for existing session
    const currentUser = userPool.getCurrentUser();
    if (currentUser) {
      currentUser.getSession((err: any, session: any) => {
        if (err) {
          setIsLoading(false);
          return;
        }
        if (session.isValid()) {
          setUser(currentUser);
        }
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: userPool,
    });

    const authDetails = new AuthenticationDetails({
      Username: username,
      Password: password,
    });

    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (session) => {
          setUser(cognitoUser);
          resolve();
        },
        onFailure: (err) => {
          reject(err);
        },
      });
    });
  };

  const logout = () => {
    user?.signOut();
    setUser(null);
  };

  const getToken = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      user?.getSession((err: any, session: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(session.getIdToken().getJwtToken());
      });
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

**Login.tsx:**
```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <h2 className="text-3xl font-bold text-center">Admin Login</h2>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Username or Email
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};
```

## Environment Variables

Add to Amplify and `.env.local`:
```
VITE_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_USER_POOL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_USER_POOL_REGION=us-east-1
```

## Testing Plan

1. **Infrastructure Testing**
   - Deploy CDK stack
   - Verify Cognito User Pool created
   - Verify authorizer attached to API

2. **Backend Testing**
   - Test user creation
   - Test authentication
   - Test protected endpoints
   - Test user management APIs

3. **Frontend Testing**
   - Test login flow
   - Test logout
   - Test protected routes
   - Test user management UI

4. **Security Testing**
   - Test unauthorized access
   - Test token expiration
   - Test password policies
   - Test group permissions

## Rollout Plan

1. Deploy infrastructure changes
2. Create initial admin user via AWS Console
3. Deploy backend Lambda functions
4. Deploy frontend with auth
5. Test login with initial admin
6. Create additional users via UI

## Initial Admin User Creation

After deployment, create the first admin user:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username admin \
  --user-attributes Name=email,Value=admin@koufobunch.com Name=email_verified,Value=true \
  --temporary-password TempPass123! \
  --message-action SUPPRESS

aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username admin \
  --group-name Admins
```

## Migration Notes

- Existing admin dashboard will require login after deployment
- No data migration needed
- Existing products remain accessible
- Public site unaffected

## Estimated Timeline

- Infrastructure: 1 hour
- Backend: 2-3 hours
- Frontend: 3-4 hours
- Testing: 1-2 hours
- **Total: 7-10 hours**

## Next Steps

Would you like me to proceed with the implementation? I can:

1. Start with infrastructure changes and deploy
2. Create the Lambda functions for user management
3. Build the frontend authentication UI
4. Test and verify everything works

Let me know if you'd like to proceed or if you have any questions about the approach!
