import api from "../services/api";

export const hasAnyPaymentMethod = (pm) => !!(pm && Object.values(pm).some(Boolean));

export const fetchPaymentMethods = async () => {
  try {
    const res = await api.get("/getUserDetails");
    return res.data?.paymentMethods ?? null;
  } catch {
    return null;
  }
};
