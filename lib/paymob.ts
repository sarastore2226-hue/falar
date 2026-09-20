// lib/paymob.ts

interface CreatePaymentIntentParams {
  amountCents: number;
  currency?: string;
  orderId: string;
  customer: {
    first_name: string;
    last_name: string;
    email?: string;
    phone: string;
    street: string;
  };
}

export async function createPaymobCheckoutSession({
  amountCents,
  currency = "EGP",
  orderId,
  customer,
}: CreatePaymentIntentParams) {
  const secretKey = process.env.PAYMOB_SECRET_KEY;
  const publicKey = process.env.PAYMOB_PUBLIC_KEY;

  if (!secretKey) {
    throw new Error("PAYMOB_SECRET_KEY is missing in environment variables");
  }

  // ✅ تمرير أرقام التكاملات كأرقام صحيحة نقية (Integers) فقط
  const paymentMethods = [5934001];

  const payload = {
    amount: amountCents,
    currency: currency,
    payment_methods: paymentMethods,
    items: [],
    billing_data: {
      first_name: customer.first_name || "عميل",
      last_name: customer.last_name || "متجر",
      phone_number: customer.phone,
      email: customer.email || "customer@vooy.shop",
      street: customer.street || "العنوان",
      building: "NA",
      floor: "NA",
      apartment: "NA",
      city: "Cairo",
      country: "EG",
    },
    special_reference: orderId,
  };

  console.log("🚀 إرسال طلب الدفع لـ Paymob:", JSON.stringify(payload, null, 2));

  const response = await fetch("https://accept.paymob.com/v1/intention/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${secretKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  console.log("📥 استجابة Paymob:", JSON.stringify(data, null, 2));

  if (!response.ok || !data.client_secret) {
    console.error("Paymob API Error:", data);
    throw new Error(data.message || "فشل في إنشاء جلسة الدفع مع Paymob");
  }

  const checkoutUrl = `https://accept.paymob.com/unifiedcheckout/?publicKey=${publicKey}&clientSecret=${data.client_secret}`;

  return {
    clientSecret: data.client_secret,
    checkoutUrl,
  };
}