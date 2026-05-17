import axios from 'axios';
import {
  BOSSU_CALLBACK_URL,
  BOSSU_API_KEY,
  BOSSU_API_BASEURL,
  BOSSU_API_ENDPOINT,
  BOSSU_API_TIMEOUT,
 } from "../config/env.js"



const bossuClient = axios.create({
  baseURL: BOSSU_API_BASEURL,
  timeout: BOSSU_API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': BOSSU_API_KEY,
  },
});






function transformBundleToPackageKey(bundleData) {
  if (!bundleData) return null;
  return bundleData.toLowerCase();
}


export async function createBossuOrder(transaction) {
  try {
    // Transform bundle data (1GB → 1gb)
    const packageKey = transformBundleToPackageKey(transaction.metadata.bundleData);

    const payload = {
      action: 'create_order',
      network: transaction.metadata.network,
      package_key: packageKey,
      recipient_phone: transaction.metadata.phoneNumberReceivingData,
      external_reference: transaction.reference,
      callback_url: BOSSU_CALLBACK_URL,
    };

    const response = await bossuClient.post(BOSSU_API_ENDPOINT, payload);


    if (response.data.success) {
      return response.data; // Return full response with nested data structure
    } else {
      console.error('❌ Bossu API error:', response.data.message);
      throw new Error(`Bossu API Error: ${response.data.message}`);
    }

  } catch (error) {
    if (error.response) {
      console.error('❌ Bossu API responded with error:');
      console.error('Status:', error.response.status);
      console.error('Message:', error.response.data.message || 'Unknown error');
      throw new Error(`Bossu API Error (${error.response.status}): ${error.response.data.message}`);
    } else if (error.request) {
      console.error('❌ No response from Bossu API');
      throw new Error('No response from Bossu API - Network issue');
    } else {
      console.error('❌ Error creating request:', error.message);
      throw error;
    }
  }
}

export async function getBossuBalance(req, res) {
  try {
    const payload ={ action : "balance" }
    const response = await bossuClient.post(BOSSU_API_ENDPOINT, payload);
   if (response.data.success) {
      return response.data.data.balance; // Return full response with nested data structure
    } else {
       console.error('❌ Bossu API error:', response.data.message);
      throw new Error(`Bossu API Error: ${response.data.message}`);
    }
  }catch(error){
    console.error("❌Error Getting Bossu Balance", error.message)
  }
};



export default {
  createBossuOrder,
  getBossuBalance
};