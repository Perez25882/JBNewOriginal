

import User from '../models/user.model.js';
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from "../config/env.js";





// CHECKS IF USER HAS THE RIGHT ACCES CONTROL PARAMETERS
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      console.log("check your req.users")
      return res.status(401).json({ 
        code: "UNAUTHORIZED", 
        message: "You must be logged in" 
      });
    }

    const userRole = req.user.role;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        code: "INSUFFICIENT_PERMISSIONS", 
        message: `Access denied: requires role(s) ${allowedRoles.join(", ")}`
      });
    }

    next();
  };
};





// THIRD ONE I CREATED V3  //works for access token
export const protect = async (req, res, next) => {
      
    const {token} = req.cookies;

    if(!token) return res.status(401).json({message: 'Unauthorized, login again'});
    

     
    try{
    const tokenDecoded = jwt.verify(token, JWT_SECRET);

    
    if(tokenDecoded){
      req.user = {
        id: tokenDecoded.id,
        email:tokenDecoded.email,
        role:tokenDecoded.role,
        isAccountVerified: tokenDecoded.isAccountVerified
       };
    }else{
        return res.status(401).json({message: 'Unauthorized, login again'});
      }

    next(); 

}catch(error){

    return res.status(401).json({message: 'Forbidden: invalid or expired token', error: error.message})
}

}






// SECOND ONE I CREATED V2
export const userAuthCookie = async (req, res, next) => {
      
    const {token} = req.cookies;
    if(!token) return res.status(401).json({message: 'Unauthorized, login again'});

     
    try{
    const tokenDecoded = jwt.verify(token, JWT_SECRET);

    if(tokenDecoded.id){
      req.body.userId = tokenDecoded.id;
    }else{
        return res.status(401).json({message: 'Unauthorized, login again'});
      }

    next(); 

}catch(error){

    return res.status(401).json({message: 'Unauthorized, login again', error: error.message})

}

}
















/// I used this when i manually added the bearer token in postman to test protected routes
//LOL this was the first one i created my baby 
//V1
export const authorize = async (req, res, next) =>{
    try{

        let token; 
        if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
            token = req.headers.authorization.split(' ')[1];
        }

        if(!token) return res.status(401).json({message: 'Unauthorized'});

        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findById(decoded.userId);

        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        req.user = user;
        
        next();

    }catch(error){

        res.status(401).json({message: 'Unauthorized', error: error.message})
    }
}
