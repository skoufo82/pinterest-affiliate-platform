// Notification service for sending emails via AWS SES

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { createLogger } from './logger';
import { Creator } from './types';

const sesClient = new SESClient({ region: process.env.REGION || 'us-east-1' });
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@koufobunch.com';
const SITE_URL = process.env.SITE_URL || 'https://www.koufobunch.com';

const logger = createLogger('notification-service');

export type NotificationType = 'productApproval' | 'productRejection' | 'accountStatusChange' | 'milestones';

export interface NotificationData {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends an email notification via AWS SES
 */
export async function sendNotification(data: NotificationData): Promise<string> {
  try {
    logger.info('Sending email notification', { to: data.to, subject: data.subject });

    const command = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [data.to],
      },
      Message: {
        Subject: {
          Data: data.subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: data.html,
            Charset: 'UTF-8',
          },
          Text: {
            Data: data.text,
            Charset: 'UTF-8',
          },
        },
      },
    });

    const result = await sesClient.send(command);
    logger.info('Email sent successfully', { messageId: result.MessageId, to: data.to });
    
    return result.MessageId || '';
  } catch (error: any) {
    logger.error('Failed to send email notification', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Checks if a creator has opted in to receive a specific notification type
 */
export function shouldSendNotification(creator: Creator, notificationType: NotificationType): boolean {
  // If preferences are not set, default to sending all notifications
  if (!creator.notificationPreferences) {
    return true;
  }

  // Check the specific preference
  return creator.notificationPreferences[notificationType] === true;
}

// Email template interfaces
export interface ProductApprovalData {
  creatorName: string;
  creatorEmail: string;
  productTitle: string;
  productId: string;
}

export interface ProductRejectionData {
  creatorName: string;
  creatorEmail: string;
  productTitle: string;
  productId: string;
  rejectionReason: string;
}

export interface AccountStatusChangeData {
  creatorName: string;
  creatorEmail: string;
  newStatus: 'active' | 'disabled';
  reason?: string;
}

export interface MilestoneData {
  creatorName: string;
  creatorEmail: string;
  milestoneType: 'page_views' | 'clicks' | 'products';
  milestoneValue: number;
  currentValue: number;
}

/**
 * Generates product approval email
 */
export function generateProductApprovalEmail(data: ProductApprovalData): NotificationData {
  const productUrl = `${SITE_URL}/admin/products/${data.productId}`;
  
  const subject = `🎉 Your Product "${data.productTitle}" Has Been Approved!`;
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Product Approved</title>
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
    .icon {
      font-size: 48px;
      margin-bottom: 10px;
    }
    .title {
      font-size: 24px;
      font-weight: bold;
      color: #10b981;
      margin-bottom: 10px;
    }
    .message {
      font-size: 16px;
      color: #4b5563;
      margin-bottom: 30px;
      line-height: 1.8;
    }
    .product-box {
      background: #f0fdf4;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      border-left: 4px solid #10b981;
    }
    .product-title {
      font-weight: 600;
      color: #065f46;
      font-size: 18px;
    }
    .button {
      display: inline-block;
      background: #10b981;
      color: white;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
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
      <div class="icon">🎉</div>
      <div class="title">Product Approved!</div>
    </div>
    
    <div class="message">
      Hi ${data.creatorName},<br><br>
      Great news! Your product has been approved and is now live on your storefront. Visitors can now discover and purchase through your affiliate link.
    </div>
    
    <div class="product-box">
      <div class="product-title">${data.productTitle}</div>
    </div>
    
    <div style="text-align: center;">
      <a href="${productUrl}" class="button">View Product</a>
    </div>
    
    <div class="message">
      Keep adding great products to grow your storefront and earn more commissions!
    </div>
    
    <div class="footer">
      <p>This is an automated message from Koufo Bunch.</p>
      <p>© ${new Date().getFullYear()} Koufo Bunch. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
  
  const text = `
Product Approved!

Hi ${data.creatorName},

Great news! Your product has been approved and is now live on your storefront.

Product: ${data.productTitle}

View your product: ${productUrl}

Keep adding great products to grow your storefront and earn more commissions!

---
Koufo Bunch Team
  `;
  
  return {
    to: data.creatorEmail,
    subject,
    html,
    text,
  };
}

/**
 * Generates product rejection email
 */
export function generateProductRejectionEmail(data: ProductRejectionData): NotificationData {
  const productUrl = `${SITE_URL}/admin/products/${data.productId}`;
  
  const subject = `Product "${data.productTitle}" Needs Revision`;
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Product Needs Revision</title>
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
    .icon {
      font-size: 48px;
      margin-bottom: 10px;
    }
    .title {
      font-size: 24px;
      font-weight: bold;
      color: #f59e0b;
      margin-bottom: 10px;
    }
    .message {
      font-size: 16px;
      color: #4b5563;
      margin-bottom: 30px;
      line-height: 1.8;
    }
    .product-box {
      background: #fffbeb;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      border-left: 4px solid #f59e0b;
    }
    .product-title {
      font-weight: 600;
      color: #92400e;
      font-size: 18px;
      margin-bottom: 10px;
    }
    .reason-box {
      background: #fef3c7;
      border-radius: 6px;
      padding: 15px;
      margin-top: 15px;
    }
    .reason-label {
      font-weight: 600;
      color: #78350f;
      margin-bottom: 5px;
    }
    .reason-text {
      color: #92400e;
    }
    .button {
      display: inline-block;
      background: #f59e0b;
      color: white;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
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
      <div class="icon">📝</div>
      <div class="title">Product Needs Revision</div>
    </div>
    
    <div class="message">
      Hi ${data.creatorName},<br><br>
      Your product submission has been reviewed and needs some revisions before it can be approved.
    </div>
    
    <div class="product-box">
      <div class="product-title">${data.productTitle}</div>
      
      <div class="reason-box">
        <div class="reason-label">Reason for revision:</div>
        <div class="reason-text">${data.rejectionReason}</div>
      </div>
    </div>
    
    <div style="text-align: center;">
      <a href="${productUrl}" class="button">Edit Product</a>
    </div>
    
    <div class="message">
      Please make the necessary changes and resubmit your product. We're here to help you succeed!
    </div>
    
    <div class="footer">
      <p>This is an automated message from Koufo Bunch.</p>
      <p>© ${new Date().getFullYear()} Koufo Bunch. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
  
  const text = `
Product Needs Revision

Hi ${data.creatorName},

Your product submission has been reviewed and needs some revisions before it can be approved.

Product: ${data.productTitle}

Reason for revision:
${data.rejectionReason}

Edit your product: ${productUrl}

Please make the necessary changes and resubmit your product. We're here to help you succeed!

---
Koufo Bunch Team
  `;
  
  return {
    to: data.creatorEmail,
    subject,
    html,
    text,
  };
}

/**
 * Generates account status change email
 */
export function generateAccountStatusChangeEmail(data: AccountStatusChangeData): NotificationData {
  const isDisabled = data.newStatus === 'disabled';
  const subject = isDisabled 
    ? 'Your Creator Account Has Been Disabled'
    : 'Your Creator Account Has Been Reactivated';
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Status Change</title>
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
    .icon {
      font-size: 48px;
      margin-bottom: 10px;
    }
    .title {
      font-size: 24px;
      font-weight: bold;
      color: ${isDisabled ? '#ef4444' : '#10b981'};
      margin-bottom: 10px;
    }
    .message {
      font-size: 16px;
      color: #4b5563;
      margin-bottom: 30px;
      line-height: 1.8;
    }
    .status-box {
      background: ${isDisabled ? '#fef2f2' : '#f0fdf4'};
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      border-left: 4px solid ${isDisabled ? '#ef4444' : '#10b981'};
    }
    .status-text {
      font-weight: 600;
      color: ${isDisabled ? '#991b1b' : '#065f46'};
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
      <div class="icon">${isDisabled ? '⚠️' : '✅'}</div>
      <div class="title">${subject}</div>
    </div>
    
    <div class="message">
      Hi ${data.creatorName},<br><br>
      ${isDisabled 
        ? 'Your creator account has been disabled by a platform administrator.'
        : 'Your creator account has been reactivated and is now active again!'}
    </div>
    
    ${data.reason ? `
    <div class="status-box">
      <div class="status-text">Reason: ${data.reason}</div>
    </div>
    ` : ''}
    
    <div class="message">
      ${isDisabled 
        ? 'If you believe this is a mistake or would like to discuss this decision, please contact our support team.'
        : 'You can now access your storefront and manage your products as usual.'}
    </div>
    
    <div class="footer">
      <p>This is an automated message from Koufo Bunch.</p>
      <p>© ${new Date().getFullYear()} Koufo Bunch. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
  
  const text = `
${subject}

Hi ${data.creatorName},

${isDisabled 
  ? 'Your creator account has been disabled by a platform administrator.'
  : 'Your creator account has been reactivated and is now active again!'}

${data.reason ? `Reason: ${data.reason}` : ''}

${isDisabled 
  ? 'If you believe this is a mistake or would like to discuss this decision, please contact our support team.'
  : 'You can now access your storefront and manage your products as usual.'}

---
Koufo Bunch Team
  `;
  
  return {
    to: data.creatorEmail,
    subject,
    html,
    text,
  };
}

/**
 * Generates milestone achievement email
 */
export function generateMilestoneEmail(data: MilestoneData): NotificationData {
  const milestoneLabels = {
    page_views: 'Page Views',
    clicks: 'Affiliate Clicks',
    products: 'Products',
  };
  
  const milestoneLabel = milestoneLabels[data.milestoneType];
  const subject = `🎊 Congratulations! You've Reached ${data.milestoneValue} ${milestoneLabel}!`;
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Milestone Achieved</title>
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
    .icon {
      font-size: 64px;
      margin-bottom: 10px;
    }
    .title {
      font-size: 28px;
      font-weight: bold;
      color: #8b5cf6;
      margin-bottom: 10px;
    }
    .message {
      font-size: 16px;
      color: #4b5563;
      margin-bottom: 30px;
      line-height: 1.8;
      text-align: center;
    }
    .milestone-box {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      padding: 30px;
      margin: 30px 0;
      text-align: center;
      color: white;
    }
    .milestone-number {
      font-size: 48px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .milestone-label {
      font-size: 20px;
      opacity: 0.9;
    }
    .button {
      display: inline-block;
      background: #8b5cf6;
      color: white;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
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
      <div class="icon">🎊</div>
      <div class="title">Milestone Achieved!</div>
    </div>
    
    <div class="message">
      Hi ${data.creatorName},<br><br>
      Congratulations! You've reached an amazing milestone!
    </div>
    
    <div class="milestone-box">
      <div class="milestone-number">${data.currentValue.toLocaleString()}</div>
      <div class="milestone-label">${milestoneLabel}</div>
    </div>
    
    <div class="message">
      This is a testament to your hard work and the quality content you're creating. Keep up the fantastic work!
    </div>
    
    <div style="text-align: center;">
      <a href="${SITE_URL}/creator/analytics" class="button">View Your Analytics</a>
    </div>
    
    <div class="footer">
      <p>This is an automated message from Koufo Bunch.</p>
      <p>© ${new Date().getFullYear()} Koufo Bunch. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
  
  const text = `
Milestone Achieved!

Hi ${data.creatorName},

Congratulations! You've reached an amazing milestone!

${data.currentValue.toLocaleString()} ${milestoneLabel}

This is a testament to your hard work and the quality content you're creating. Keep up the fantastic work!

View your analytics: ${SITE_URL}/creator/analytics

---
Koufo Bunch Team
  `;
  
  return {
    to: data.creatorEmail,
    subject,
    html,
    text,
  };
}
