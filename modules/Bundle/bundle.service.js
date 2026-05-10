import {createError, throwResponse} from "../../utils/error.js"

import { findBundleById, createBundle } from './bundle.repository.js'
import { validateCreateBundle } from './bundle.validator.js'


export const createBundleService = async (data) => {
    const validatedData = validateCreateBundle(data)
    const existingBundle = await findBundleById(validatedData.Bundle_id)
     if (existingBundle) {
        throwResponse(409, "Bundle With this Id already exists",)
    }
    return await createBundle(validatedData)
}

