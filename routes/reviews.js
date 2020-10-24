var express = require("express");
const middlewareObj = require("../middleware");
var router = express.Router({mergeParams: true});
var middleware = require("../middleware");
var Campground = require("../models/campground");
var Review = require("../models/review");

function calculateAverage(reviews) {
    if(reviews.length === 0) {
        return 0;
    }
    var sum = 0;
    reviews.forEach(function(review) {
        sum += review.rating;
    });
    return sum / reviews.length;
}

//Reviews Index
router.get("/", function(req, res) {
    Campground.findById(req.params.id).populate({
        path: "reviews",
        options: {sort: {createdAt: -1}} // sorting the populated reviews array to show the latest first
    }).exec(function(err, campground) {
        if(err || !campground) {
            req.flash("error", err.message);
            return res.redirect("back");
        }
        res.render("reviews/index", {campground});
    });
});

//Reviews New
router.get("/new", middlewareObj.isLoggedIn, middlewareObj.checkReviewExistence, function(req, res) {
    // middleware.checkReviewExistence checks if a user already reviewed the campground, only one review per user is allowed
    Campground.findById(req.params.id, function(err, campground) {
        if(err) {
            req.flash("error", err.message);
            return res.redirect("back");
        }
        res.render("reviews/new", {campground});
    });
});

//Reviews Create
router.post("/", middlewareObj.isLoggedIn, middlewareObj.checkReviewExistence, function(req, res) {
    //lookup campground using ID
    Campground.findById(req.params.id).populate("reviews").exec(function(err, campground){
        if(err) {
            req.flash("error", err.message);
            return res.redirect("back");
        }
        Review.create(req.body.review, function(err, review) {
            if(err) {
                req.flash("error", err.message);
                return res.redirect("back");
            }
            //add author username/id and associated campground to the review
            review.author.id = req.user._id;
            review.author.username = req.user.username;
            review.campground = campground;
            //save review
            review.save();
            campground.reviews.push(review);
            // calculate the new average review for the campground
            campground.rating = calculateAverage(campground.reviews);
            //save campground
            campground.save();
            req.flash("success", "Your review has been successfully added.");
            res.redirect("/campgrounds/" + campground._id);
        });
    });
});

//Reviews Edit
router.get("/:review_id/edit", middleware.checkReviewOwnership, function(req, res) {
    Review.findById(req.params.review_id, function(err, foundReview) {
        if(err) {
            req.flash("error", err.message);
            return res.redirect("back");
        }
        res.render("reviews/edit", {campground_id: req.params.id, review: foundReview});
    });
});

//Reviews Update
router.put("/:review_id", middleware.checkReviewOwnership, function(req, res) {
    Review.findByIdAndUpdate(req.params.review_id,  req.body.review, {new: true}, function(err, updatedReview) {
        if(err){
            req.flash("error", err.message);
            return res.redirect("back");
        } 
        Campground.findById(req.params.id).populate("reviews").exec(function(err, campground) {
            if(err){
                req.flash("error", err.message);
                return res.redirect("back");
            }
            // recalculate campground average
            campground.rating = calculateAverage(campground.reviews);
            campground.save();
            req.flash("success", "Review updated");
            res.redirect("/campgrounds/" + campground._id);
        });
    });
});

//Reviews Delete
router.delete("/:review_id", middleware.checkReviewOwnership, function(req, res) {
    Review.findByIdAndDelete(req.params.review_id, function(err) {
        if(err){
            req.flash("error", err.message);
            res.redirect("back");
        }
        Campground.findByIdAndUpdate(req.params.id, {$pull: {reviews: req.params.review_id}}, {new:true}).populate("reviews").exec(function(err, campground) {
            if(err){
                req.flash("error", err.message);
                res.redirect("back");
            }
            // recalculate campground average
            campground.rating = calculateAverage(campground.reviews);
            campground.save();
            req.flash("success", "Comment deleted");
            res.redirect("/campgrounds/" + req.params.id);
        });       
    });
});

module.exports = router;