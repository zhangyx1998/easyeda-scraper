export const easyeda = (path) => `https://pro.easyeda.com/api/${path}`;

// Search for a product based on its name
export async function product(keyword) {
  const res = await fetch(easyeda("eda/product/search"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ keyword }),
  });
  const { result } = await res.json();
  return result?.productList ?? [];
}

// Extract device information (e.g. part name, datasheet ...) from its UUID
export async function device(uuid) {
  const res = await fetch(easyeda(`devices/${uuid}`), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  const { result } = await res.json();
  const { uuid: _, ...device } = result;
  return { [uuid]: device };
}

// Extract necessary symbol/footprint information from return of product()
export function extract(obj) {
  const { dataStr, modifier, owner, uuid, ...cleaned } = obj;
  return { [uuid]: cleaned };
}

