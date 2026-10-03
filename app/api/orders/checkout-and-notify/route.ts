import { POST as handleCheckout } from '../../checkout/route';

export async function POST(request: Request) {
  return handleCheckout(request);
}
