export interface WelcomeEmailData {
  username: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
  firstName?: string;
  lastName?: string;
}

export const generateWelcomeEmail = (data: WelcomeEmailData): { subject: string; html: string; text: string } => {
  const displayName = data.firstName ? `${data.firstName}${data.lastName ? ` ${data.lastName}` : ''}` : data.username;
  
  const subject = `Welcome to Koufo Bunch Admin Portal - Your Account is Ready!`;
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Koufo Bunch</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8fafc;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            color: #6366f1;
            margin-bottom: 10px;
        }
        .welcome-text {
            font-size: 18px;
            color: #4b5563;
            margin-bottom: 30px;
        }
        .credentials-box {
            background: #f3f4f6;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            border-left: 4px solid #6366f1;
        }
        .credential-item {
            margin: 10px 0;
        }
        .credential-label {
            font-weight: 600;
            color: #374151;
        }
        .credential-value {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            background: white;
            padding: 8px 12px;
            border-radius: 4px;
            border: 1px solid #d1d5db;
            display: inline-block;
            margin-left: 10px;
        }
        .login-button {
            display: inline-block;
            background: #6366f1;
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
            text-align: center;
        }
        .login-button:hover {
            background: #4f46e5;
        }
        .instructions {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
        }
        .instructions h3 {
            margin-top: 0;
            color: #92400e;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 14px;
            color: #6b7280;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎯 Koufo Bunch</div>
            <h1>Welcome to the Admin Portal!</h1>
        </div>
        
        <div class="welcome-text">
            Hi ${displayName},<br><br>
            Your admin account has been created successfully! You now have access to the Koufo Bunch admin portal where you can manage products, users, and more.
        </div>
        
        <div class="credentials-box">
            <h3>Your Login Credentials</h3>
            <div class="credential-item">
                <span class="credential-label">Username:</span>
                <span class="credential-value">${data.username}</span>
            </div>
            <div class="credential-item">
                <span class="credential-label">Temporary Password:</span>
                <span class="credential-value">${data.temporaryPassword}</span>
            </div>
        </div>
        
        <div style="text-align: center;">
            <a href="${data.loginUrl}?username=${encodeURIComponent(data.username)}" class="login-button">
                🚀 Access Admin Portal
            </a>
        </div>
        
        <div class="instructions">
            <h3>📋 Next Steps:</h3>
            <ol>
                <li>Click the "Access Admin Portal" button above</li>
                <li>Your username will be pre-filled</li>
                <li>Enter the temporary password shown above</li>
                <li>You'll be prompted to create a new secure password</li>
                <li>Start managing your affiliate products!</li>
            </ol>
        </div>
        
        <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>If you have any questions, please contact your administrator.</p>
            <p><strong>Security Note:</strong> This temporary password will expire in 7 days.</p>
        </div>
    </div>
</body>
</html>
`;

  const text = `
Welcome to Koufo Bunch Admin Portal!

Hi ${displayName},

Your admin account has been created successfully!

Login Credentials:
- Username: ${data.username}
- Temporary Password: ${data.temporaryPassword}

To get started:
1. Visit: ${data.loginUrl}?username=${encodeURIComponent(data.username)}
2. Enter your temporary password
3. Create a new secure password when prompted

This temporary password will expire in 7 days.

If you have any questions, please contact your administrator.

---
Koufo Bunch Team
`;

  return { subject, html, text };
};
