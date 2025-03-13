export const easyeda = (path) => `https://pro.easyeda.com/api/${path}`;
export const LCSC = (query) => `https://wmsc.lcsc.com/ftps/wm/search/global?${query}`;

// Search for a product based on its name
export async function product(keyword) {
  console.log('Searching EasyEDA for product:', keyword);
  try {
    const url = easyeda("eda/product/search");
    console.log('Fetching from URL:', url);
    
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": "https://pro.easyeda.com",
        "Referer": "https://pro.easyeda.com/"
      },
      body: JSON.stringify({ 
        keyword,
        type: "LCSC", // Add type parameter
        from: 0,
        to: 50
      }),
    });

    console.log('Response status:', res.status);
    console.log('Response headers:', Object.fromEntries(res.headers.entries()));

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Error response body:', errorText);
      throw new Error(`EasyEDA API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    console.log('EasyEDA search response:', data);

    if (!data.result) {
      throw new Error('Invalid response from EasyEDA API');
    }

    return data.result?.productList ?? [];
  } catch (error) {
    console.error('Error searching EasyEDA:', error);
    throw new Error(`Failed to search EasyEDA: ${error.message}`);
  }
}

// allow searching with rules (price, stock, model)
export async function search(keyword) {
  console.log('Searching LCSC for keyword:', keyword);
  try {
    const params = {
      keyword,
      pageSize: 100,
      sortField: "stock",
      sortType: "desc",
      currentPage: 1
    };

    const query = new URLSearchParams(params).toString();
    const url = LCSC(query);
    console.log('Fetching from URL:', url);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": "https://wmsc.lcsc.com",
        "Referer": "https://wmsc.lcsc.com/"
      }
    });

    console.log('Response status:', res.status);
    console.log('Response headers:', Object.fromEntries(res.headers.entries()));

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Error response body:', errorText);
      throw new Error(`LCSC API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    console.log('LCSC search response:', data);

    if (!data.result) {
      throw new Error('Invalid response from LCSC API');
    }

    return data.result?.productSearchResultVO?.productList ?? [];
  } catch (error) {
    console.error('Error searching LCSC:', error);
    throw new Error(`Failed to search LCSC: ${error.message}`);
  }
}

// Extract device information (e.g. part name, datasheet ...) from its UUID
export async function device(uuid) {
  console.log('Fetching device information for UUID:', uuid);
  try {
    const url = easyeda(`devices/${uuid}`);
    console.log('Fetching from URL:', url);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": "https://pro.easyeda.com",
        "Referer": "https://pro.easyeda.com/"
      },
    });

    console.log('Response status:', res.status);
    console.log('Response headers:', Object.fromEntries(res.headers.entries()));

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Error response body:', errorText);
      throw new Error(`EasyEDA API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    console.log('Device info response:', data);

    if (!data.result) {
      throw new Error('Invalid response from EasyEDA API');
    }

    const { uuid: _, ...device } = data.result;
    return { [uuid]: device };
  } catch (error) {
    console.error('Error fetching device:', error);
    throw new Error(`Failed to fetch device info: ${error.message}`);
  }
}

// Extract necessary symbol/footprint information from return of product()
export function extract(obj) {
  if (!obj || !obj.uuid) {
    console.warn('Invalid object passed to extract:', obj);
    return {};
  }
  const { dataStr, modifier, owner, uuid, ...cleaned } = obj;
  return { [uuid]: cleaned };
} 