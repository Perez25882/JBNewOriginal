import Bundle from '../../models/bundle.model.js'

export const findBundleById = async (Bundle_id) => {
  return await Bundle.findOne({ Bundle_id })
}

export const createBundle = async (data) => {
  return await Bundle.create(data)
}

export const fetchAllBundles = async () => {
  return await Bundle.find().sort({ network: 1, JBCP: 1 })
}