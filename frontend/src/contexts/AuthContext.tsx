import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  CognitoUser,
  AuthenticationDetails,
  CognitoUserPool,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

interface AuthContextType {
  user: CognitoUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  userGroups: string[];
  login: (username: string, password: string, newPassword?: string) => Promise<void>;
  logout: () => void;
  getToken: () => Promise<string | null>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Get environment variables
const userPoolId = (import.meta as { env?: { VITE_USER_POOL_ID?: string } }).env?.VITE_USER_POOL_ID;
const clientId = (import.meta as { env?: { VITE_USER_POOL_CLIENT_ID?: string } }).env?.VITE_USER_POOL_CLIENT_ID;

// Initialize user pool with error handling
let userPool: CognitoUserPool | null = null;

if (userPoolId && clientId) {
  try {
    userPool = new CognitoUserPool({
      UserPoolId: userPoolId,
      ClientId: clientId,
    });
  } catch (error) {
    console.warn('Failed to initialize Cognito User Pool:', error);
  }
} else {
  console.warn('Cognito environment variables not found. Authentication will be disabled.');
  console.warn('VITE_USER_POOL_ID:', userPoolId);
  console.warn('VITE_USER_POOL_CLIENT_ID:', clientId);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CognitoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Helper function to extract groups from session
  const updateUserGroups = (session: CognitoUserSession) => {
    try {
      const idToken = session.getIdToken();
      const payload = idToken.decodePayload();
      const groups = payload['cognito:groups'] || [];
      setUserGroups(groups);
      setIsAdmin(groups.includes('Admins'));
    } catch (error) {
      console.warn('Failed to extract user groups:', error);
      setUserGroups([]);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    // Check for existing session on mount
    if (!userPool) {
      setIsLoading(false);
      return;
    }
    
    try {
      const currentUser = userPool.getCurrentUser();
      if (currentUser) {
        currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
          if (err || !session?.isValid()) {
            setIsLoading(false);
            return;
          }
          setUser(currentUser);
          updateUserGroups(session);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.warn('Failed to get current user:', error);
      setIsLoading(false);
    }
  }, []);

  const login = async (username: string, password: string, newPassword?: string): Promise<void> => {
    if (!userPool) {
      throw new Error('Authentication is not available in private browsing mode. Please use a regular browser window.');
    }
    
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: username,
        Pool: userPool,
      });

      const authDetails = new AuthenticationDetails({
        Username: username,
        Password: password,
      });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (session: CognitoUserSession) => {
          setUser(cognitoUser);
          updateUserGroups(session);
          resolve();
        },
        onFailure: (err: Error) => {
          reject(err);
        },
        newPasswordRequired: (userAttributes, _requiredAttributes) => {
          // If a new password was provided, complete the challenge
          if (newPassword) {
            // Remove attributes that shouldn't be updated
            delete userAttributes.email_verified;
            delete userAttributes.email;
            
            cognitoUser.completeNewPasswordChallenge(newPassword, userAttributes, {
              onSuccess: (session: CognitoUserSession) => {
                setUser(cognitoUser);
                updateUserGroups(session);
                resolve();
              },
              onFailure: (err: Error) => {
                reject(err);
              },
            });
          } else {
            // Reject with a special error that indicates new password is required
            const error: any = new Error('NEW_PASSWORD_REQUIRED');
            error.name = 'NewPasswordRequiredException';
            error.userAttributes = userAttributes;
            error.cognitoUser = cognitoUser;
            reject(error);
          }
        },
      });
    });
  };

  const logout = () => {
    if (user) {
      user.signOut();
      setUser(null);
      setUserGroups([]);
      setIsAdmin(false);
    }
  };

  const getToken = async (): Promise<string | null> => {
    if (!user) return null;

    return new Promise((resolve, reject) => {
      user.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          reject(err);
          return;
        }
        resolve(session.getIdToken().getJwtToken());
      });
    });
  };

  const refreshSession = async (): Promise<void> => {
    if (!user) return;

    return new Promise((resolve, reject) => {
      user.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          reject(err);
          return;
        }
        
        const refreshToken = session.getRefreshToken();
        user.refreshSession(refreshToken, (err: Error | null) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isAdmin,
        userGroups,
        login,
        logout,
        getToken,
        refreshSession,
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
