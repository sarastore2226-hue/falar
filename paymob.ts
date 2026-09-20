export type PaymobMode = "test" | "live";

export interface PaymobConfig {
  apiKey: string;
  secretKey: string;
  merchantId: string;
  integrationId: string;
  iframeId?: string;
  walletId?: string;
  redirectUrl: string;
  mode?: PaymobMode;
  baseUrl?: string;
}

export interface PaymobBillingData {
  apartment?: string;
  email: string;
  floor?: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  street?: string;
  city?: string;
  country?: string;
  state?: string;
  postal_code?: string;
}

export interface PaymobOrderItem {
  name: string;
  amount_cents: number;
  quantity: string | number;
  description?: string;
}

export interface CreatePaymobPaymentInput {
  amountCents: number;
  currency?: string;
  orderId: string;
  billingData: PaymobBillingData;
  items: PaymobOrderItem[];
  walletToken?: string;
  redirectUrl?: string;
}

export interface PaymobAuthResponse {
  token?: string;
  data?: {
    token?: string;
  };
  message?: string;
}

export interface PaymobPaymentResponse {
  id?: number | string;
  payment_key?: string;
  redirect_url?: string;
  iframe_url?: string;
  message?: string;
  [key: string]: unknown;
}

export function getPaymobBaseUrl(mode: PaymobMode = "test", baseUrl?: string) {
  if (baseUrl) return baseUrl.replace(/\/$/, "");

  return mode === "live"
    ? "https://accept.paymob.com/api"
    : "https://accept.paymob.com/api";
}

export async function getPaymobAuthToken(config: PaymobConfig): Promise<string> {
  const apiKey = config.apiKey?.trim();
  const secretKey = config.secretKey?.trim();

  if (!apiKey || !secretKey) {
    throw new Error("Paymob API key and secret key are required.");
  }

  const response = await fetch(`${getPaymobBaseUrl(config.mode, config.baseUrl)}/auth/tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      secret_key: secretKey,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch Paymob auth token: ${errorText}`);
  }

  const payload = (await response.json()) as PaymobAuthResponse;
  const token = payload.token ?? payload.data?.token;

  if (!token) {
    throw new Error("Paymob auth response did not include a token.");
  }

  return token;
}

export async function createPaymobPayment(
  config: PaymobConfig,
  payload: CreatePaymobPaymentInput
): Promise<PaymobPaymentResponse> {
  const token = await getPaymobAuthToken(config);

  const requestBody = {
    amount_cents: payload.amountCents,
    currency: payload.currency ?? "EGP",
    integration_id: config.integrationId,
    order_id: payload.orderId,
    billing_data: payload.billingData,
    items: payload.items,
    wallet_token: payload.walletToken,
    redirect_url: payload.redirectUrl ?? config.redirectUrl,
    iframe: Boolean(config.iframeId),
    merchant_id: config.merchantId,
  };

  const response = await fetch(`${getPaymobBaseUrl(config.mode, config.baseUrl)}/ecommerce/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${token}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create Paymob payment: ${errorText}`);
  }

  return (await response.json()) as PaymobPaymentResponse;
}

export async function verifyPaymobPayment(
  config: PaymobConfig,
  orderId: string
): Promise<Record<string, unknown>> {
  const token = await getPaymobAuthToken(config);

  const response = await fetch(
    `${getPaymobBaseUrl(config.mode, config.baseUrl)}/ecommerce/orders/${orderId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Token ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to verify Paymob payment: ${errorText}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

export function buildPaymobRedirectUrl(baseUrl: string, orderId: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  return `${normalizedBaseUrl}/payment/success?orderId=${encodeURIComponent(orderId)}`;
}
