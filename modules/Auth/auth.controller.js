import mongoose from "mongoose";
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken';
import User from "../../models/user.model.js";
import { JWT_EXPIRES_IN, JWT_SECRET, JWT_REFRESH_SECRET, NODE_ENV } from "../../config/env.js";
// import { sendWelcomeEmail, sendOTPEmail } from "../utils/send-email.js";
import { sendWelcomeEmail, sendOTPEmail } from "../../services/emailServices/email.service.js";
import { generateTokens } from '../../utils/token_util.js';  ///NEW IMPORT


// import { NODE_ENV, } from "../config/env.js";   //might have to uncomment this later as well as dotenv not sure


//USER REGISTERING AN ACCOUNT THEMSELVES
export const signUp = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction(); // I actually learnt this in class for relational dbs, makes the database atomic
    //all or nothing, no halfway authentications, it either works or it doesn't



    // So that we don't have to send empty details to the server
    const { name, email, phoneNumber, password } = req.body;

    if (!name || !email || !password || !phoneNumber) {
        return res.json({
            success: false,
            message: "Missing details, please provide them all"
        });
    }



    try {
        //Check if user already exists
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            const error = new Error('User already exists')
            error.statusCode = 409;
            throw error;
        }


        const existingPhoneNumber = await User.findOne({ phoneNumber });

        if (existingPhoneNumber) {
            const error = new Error('Phone number already exists')
            error.statusCode = 409;
            throw error;
        }

        //If newuser doesn't already exit continue flow and hash created passwords
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUsers = await User.create([{ name, email, password: hashedPassword, phoneNumber }], { session }); // I might change this later for just singleNewUser creation
        // const token = jwt.sign({id: newUsers[0]._id }, JWT_SECRET, {expiresIn: JWT_EXPIRES_IN});
        // const token = jwt.sign({ id: newUsers[0]._id, role: newUsers[0].role, email: newUsers[0].email, isAccountVerified: newUsers[0].isAccountVerified }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });



        // const token = jwt.sign({userId: newUsers[0]._id }, JWT_SECRET, {expiresIn: JWT_EXPIRES_IN});
        await session.commitTransaction();
        session.endSession();

        //Safe user instance that does not return secure info
        const safeUser = {
            _id: newUsers[0]._id,
            name: newUsers[0].name,
            email: newUsers[0].email,
            phoneNumber: newUsers[0].phoneNumber,
            role: 'user',// Always set to 'user', ignore req.body.role
            isAccountVerified: newUsers[0].isAccountVerified,
            createdAt: newUsers[0].createdAt,
        };


        const tokens = generateTokens(newUsers[0])
        newUsers[0].accessToken = tokens.accessToken;
        newUsers[0].refreshToken = tokens.refreshToken;



        //res.cookies // don't forget to set cookies here later
        // res.cookie('token', token, {
        //     httpOnly: true,
        //     secure: process.env.NODE_ENV === 'production', //only send cookie over https
        //     sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        //     maxAge: 1000 * 60 * 60 * 24 * 7, //1 week 
        // })

        //         // // store access token in cookie (short-lived)
        // res.cookie('token', tokens.accessToken, {
        //     httpOnly: true,
        //     secure: true, //only send cookie over https
        //     sameSite: 'none',    // more look into this later!!!!!!
        //     maxAge: 1000 * 60 * 60, //1h
        // });


        //      // // store refresh token in cookie (long-lived)
        // res.cookie('refreshToken', tokens.refreshToken, {
        //     httpOnly: true,
        //     secure: true, //only send cookie over https!!!
        //     sameSite: 'none',    // more look into this later!!!
        //     maxAge: 1000 * 60 * 60 * 24 * 7, //1 week
        // });


        const isProduction = NODE_ENV === 'production';

        // Set cookies
        res.cookie('token', tokens.accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'lax' : 'lax',
            domain: isProduction ? '.joydatabundle.com' : undefined,
            maxAge: 1000 * 60 * 60,
            path: '/',
        });

        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'lax' : 'lax',
            domain: isProduction ? '.joydatabundle.com' : undefined,
            maxAge: 1000 * 60 * 60 * 24 * 7,
            path: '/',
        });





        // Sends the welcome email 
        sendWelcomeEmail({
            to: email,
            userName: name
        }).catch(err => {
            console.error("Failed to send welcome email (JS:120 AC):", err);
        });

        //Send The response
        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: safeUser,
        });



    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
    }

}





//USER TRYING TO LOG INTO AN THIER ACCOUNT
export const signIn = async (req, res, next) => {

    // So that we don't have to send empty details to the server
    const { email, password } = req.body;
    if (!email || !password) {
        return res.json(
            {
                success: false,
                message: 'Missing Details, Please provide them'
            }
        )
    }


    try {

        //Get the user from db
        const user = await User.findOne({ email });

        if (!user) {
            const error = new Error('Invalid credentials');
            error.statusCode = 401;
            throw error;
        };

        const isPasswordValid = await bcrypt.compare(password, user.password)
        if (!isPasswordValid) {
            const error = new Error('Invalid credentials')
            error.statusCode = 401;
            throw error;
        };



        //THIS IS THE NEW THING I ADDED BELOW




        const tokens = generateTokens(user);// generate my tokens
        user.accessToken = tokens.accessToken;  //put it in the user model accessToken field
        user.refreshToken = tokens.refreshToken; //put it in the user model refreshToken field
        await user.save(); //save the user with the new tokens




        const isProduction = NODE_ENV === 'production';

        // Set cookies
        res.cookie('token', tokens.accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'lax' : 'lax',
            domain: isProduction ? '.joydatabundle.com' : undefined,
            maxAge: 1000 * 60 * 60,
            path: '/',
        });

        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'lax' : 'lax',
            domain: isProduction ? '.joydatabundle.com' : undefined,
            maxAge: 1000 * 60 * 60 * 24 * 7,
            path: '/',
        });









        //Clean put only userdata that are safe returning over here
        const safeUser = {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isAccountVerified: user.isAccountVerified,
            createdAt: user.createdAt,
        };

        //  pushing the token in a cookie
        //   res.cookie('token', token,{
        //     httpOnly:true ,
        //     secure: process.env.NODE_ENV === 'production', //only send cookie over https
        //     sameSite: process.env.NODE_ENV ==='production'? 'none': 'lax',    // more look into this later!!!!!!
        //     maxAge: 1000 * 60 * 60 * 24 * 7, //1 week 
        //   })



        //ORIGINAL OVER HERE/////////////////////////////
        // res.cookie('token', token, {
        //     httpOnly: true,
        //     secure: true, //only send cookie over https
        //     sameSite: 'none',    // more look into this later!!!!!!
        //     maxAge: 1000 * 60 * 60 * 24 * 7, //1 week 
        // })




        // I will remove this later, currently just for testing purposes
        res.status(200).json(
            {
                success: true,
                message: 'User signed in successfully',
                user: safeUser // expecting the user with that particular email

            }
        )


    } catch (error) {
        console.log(error)

        // Handle custom errors with statusCode
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        // Handle any other unexpected errors
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });

        // next(error) I will add this later when i create a middleware for handling
        //SignUp/signIn/SignOut errors, right now we handle it locally

    }
}


//USER LOGGING OUT OF THIER ACCOUNT
export const signOut = async (req, res, next) => {

    try {

        const userId = req.user.id

        // Invalidate tokens in database if user exists
        if (userId) {
            await User.findByIdAndUpdate(
                userId,
                {
                    $set: {
                        refreshToken: null,
                        accessToken: null
                    }
                },
                { new: true }
            );
        }

        // res.clearCookie('token', {
        //     httpOnly: true,
        //     secure: true,
        //     sameSite: 'none'
        // });

        // res.clearCookie('refreshToken', {
        //     httpOnly: true,
        //     secure: true,
        //     sameSite: 'none'
        // })


        res.clearCookie('token', {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            domain: ".joydatabundle.com",
            path: "/",
        });

        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            domain: ".joydatabundle.com",
            path: "/",
        })




        return res.json({ success: true, message: "Sign out successful" });

    } catch (error) {
        console.log(error)
        next(error)
    }

}



// SEND VERIFICATION OTP TO THE USERS EMAIL   // will uncomment it when i add the need columns to the user model
export const sendVerifyOtp = async (req, res, next) => {

    try {
        //since there is no option to send userId in the body from the frontend, I will just use the user from the authorize middleware

        const { id } = req.user;
        console.log("otpdebug", id)
        const user = await User.findById(id);

        if (user.isAccountVerified) {
            return res.json({ success: false, message: 'Account already verified' })
        }


        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate a 6-digit OTP
        user.verifyOtp = otp;
        user.verifyOtpExpireAt = Date.now() + 10 * 60 * 1000; // OTP valid for 10 minutes 
        await user.save();


        // Sends the OTP email  
        await sendOTPEmail({
            to: user.email,
            userName: user.name,
            otpCode: otp,
            expiryMinutes: 10,
        });



        res.json({ success: true, message: 'Verification OTP email sent successfully' })



    } catch (error) {
        res.json({ success: false, message: 'Could not send verification OTP email', error: error.message })
        next(error)
    }
    // Implementation for sending verification email
}



// VERIFY EMAIL ACCOUNT VIA OTP BEING SENT WHEN USER INPUTS IT  // will uncomment it when i add the need columns to the user model
export const verifyEmail = async (req, res, next) => {

    //since there is no option to send userId in the body from the frontend, I will just use the user from the authorize middleware
    const { otp } = req.body;
    const { id } = req.user;

    if (!id || !otp) {
        return res.json({ success: false, message: 'Missing details, please provide them' })
    }
    try {

        const user = await User.findById(id);

        // If user with the provided id doesn't exist
        if (!user) {
            const error = new Error('Account verification failed');
            error.statusCode = 500; // Internal server error
            throw error;
        }

        //Checks OTP entered and OTP in the users database are the same
        if (user.verifyOtp === '' || user.verifyOtp !== otp) {
            return res.json({ success: false, message: 'Invalid OTP' })
        }

        //Checks if OTP has expired
        if (user.verifyOtpExpireAt < Date.now()) {
            return res.json({ success: false, message: 'OTP has expired, please request a new one' })
        }

        // If everything is fine, verify the users account
        user.isAccountVerified = true;
        user.verifyOtp = '';
        user.verifyOtpExpireAt = 0;

        await user.save();
        res.json({ success: true, message: 'Email Account verified successfully' })


    } catch (error) {
        console.log(error)

        // Handle custom errors with statusCode
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        // Handle any other unexpected errors
        return res.status(500).json({
            success: false,
            message: 'Could not verify account'
        });


        //next(error) didnt use it here to, until i create auth error handling middleware
    }

}



//CHECK IF USER IS AUTHENTICATED
export const isAuthenicated = async (req, res) => {
    try {
        // req.user is set by protect middleware
        // It already verified the JWT token exists and is valid

        const { id } = req.user
        // Get full user data from database (fresher than JWT payload)
        const user = await User.findById(id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }






        // Return user data (this is what AuthContext will use)
        return res.json({
            success: true,
            message: 'User is authenticated and still has valid session',
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isAccountVerified: user.isAccountVerified,
                createdAt: user.createdAt,
            }
        });

    } catch (error) {
        console.error('Verify auth error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during authentication verification',
            error: error.message
        });
    }
};







//SEND PASSWORD RESET OTP
export const sendResetOtp = async (req, res) => {
    // const { email } = req.user;
    const { email } = req.body;

    if (!email) {
        return res.json({ success: false, message: "Email is required" })
    }

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.json({
                success: false, message: "User not found"
            })
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate a 6-digit OTP
        user.resetOtp = otp;
        user.resetOtpExpireAt = Date.now() + 10 * 60 * 1000; // OTP valid for 10 minutes 
        await user.save();


        // Sends the OTP email  
        await sendOTPEmail({
            to: user.email,
            userName: user.name,
            otpCode: otp,
            expiryMinutes: 10,
        });

        res.json({ success: true, message: "Reset OTP sent to email" })

    } catch (error) {
        res.json({ success: false, message: 'Could not send reset OTP email', error: error.message })
        next(error)
    }
}







//VERIFY EMAIL FOR PASSWORD RESET OTP, REMEMBER THE USER IS NOT LOGGED IN RIGHT NOW SO WE CAN'T USE 
// TOKEN_ID TO VERIFY ACCOUNT EXISTENCE, RATHER HE WOULD MANUALLY ADD HIS EMAIL TO THE REQUEST.BODY THEN WE CHECK
// IF HIS ACCOUNT EXIST, AND SENT THE OTP TO EMAIL
export const verifyresetOtp = async (req, res, next) => {

    //since there is no option to send userId in the body from the frontend, I will just use the user from the authorize middleware
    const { otp, email } = req.body;


    if (!email || !otp) {
        return res.json({ success: false, message: 'Missing details, please provide them' })
    }
    try {

        const user = await User.findOne({ email });


        // If user with the provided id doesn't exist
        if (!user) {
            const error = new Error('Account verification failed');
            error.statusCode = 500; // Internal server error
            throw error;
        }

        //Checks OTP entered and OTP in the users database are the same
        if (user.resetOtp === '' || user.resetOtp !== otp) {
            return res.json({ success: false, message: 'Invalid OTP' })
        }

        //Checks if OTP has expired
        if (user.resetOtpExpireAt < Date.now()) {
            return res.json({ success: false, message: 'OTP has expired, please request a new one' })
        }

        // If everything is fine, verify the users account
        user.isAccountVerified = true;


        await user.save();
        res.json({ success: true, message: 'ResetOTP Valid' })


    } catch (error) {
        console.log(error)

        // Handle custom errors with statusCode
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        // Handle any other unexpected errors
        return res.status(500).json({
            success: false,
            message: 'Could not verify reset OTP account'
        });


        //next(error) didnt use it here to, until i create auth error handling middleware
    }

}
















//RESET USER PASSWORD
export const resetPassword = async (req, res, next) => {

    const { newPassword, email, otp } = req.body;

    if (!email || !otp || !newPassword) {
        return res.json({
            success: false,
            message: "Email, OTP and new Password are required"
        })
    };



    try {
        const user = await User.findOne({ email });
        if (!user) {
            const error = new Error('New Password Creation failed');
            error.statusCode = 500; // Internal server error
            throw error;
        };


        console.log("Reset Password should be working if this consoles", user.name + newPassword + otp)


        if (user.resetOtp === "" || user.resetOtp !== otp) {
            return res.json({
                success: false,
                message: "Invalid OTP"
            })
        };


        if (user.resetOtpExpireAt < Date.now()) {
            return res.json({
                success: false, message: "reset OTP expired"
            })
        };




        //hash the new password and push to database
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        user.password = hashedPassword;
        user.resetOtp = '';
        user.resetOtpExpireAt = 0;



        await user.save();

        return res.json({
            success: true, message: 'Password has been reset successfully'
        });

    } catch (error) {
        // Handle custom errors with statusCode
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        // Handle any other unexpected errors
        return res.status(500).json({
            success: false,
            message: 'Could not verify reset OTP account'
        });


    }
}






export const refresh = async (req, res, next) => {
    const { refreshToken } = req.cookies;
    if (!refreshToken) return res.status(401).json({ message: "No refresh token" });

    try {
        const tokenDecoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET)

        const user = await User.findById(tokenDecoded.id);

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(401).json({ message: "Invalid refresh token" });
        }

        const tokens = generateTokens(user);
        user.accessToken = tokens.accessToken;
        user.refreshToken = tokens.refreshToken;

        await user.save();

        const isProduction = NODE_ENV === 'production';

        // Reset cookies
        res.cookie("token", tokens.accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "lax" : "lax",
            domain: isProduction ? '.joydatabundle.com' : undefined,
            maxAge: 1000 * 60 * 15,
            path: '/',
        });

        res.cookie("refreshToken", tokens.refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "lax" : "lax",
            domain: isProduction ? '.joydatabundle.com' : undefined,
            maxAge: 1000 * 60 * 60 * 24 * 7,
            path: '/',
        });

        res.json({ success: true, message: "Tokens refreshed" });
    } catch (error) {
        console.log(error)
        return res.status(403).json({ message: "Invalid refresh token session ended login again" })
    }
}